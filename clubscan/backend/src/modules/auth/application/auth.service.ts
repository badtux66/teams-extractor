import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { OAuthProvider, User, UserStatus } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { EVENT_BUS, EventBusPort } from '@/platform/event-bus/event-bus.port';
import { DomainEvent } from '@/shared/domain/domain-event';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { MAILER, MailerPort } from './ports/mailer.port';
import { OAUTH_VERIFIER, OAuthVerifierPort } from './ports/oauth-verifier.port';
import { TokenPair, TokenService } from './token.service';

class UserRegisteredEvent extends DomainEvent<{ userId: string }> {
  readonly name = 'user.registered';
  constructor(readonly payload: { userId: string }) {
    super();
  }
}

interface RequestContext {
  ip?: string;
  userAgent?: string;
}

const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    @Inject(MAILER) private readonly mailer: MailerPort,
    @Inject(OAUTH_VERIFIER) private readonly oauth: OAuthVerifierPort,
    @Inject(EVENT_BUS) private readonly bus: EventBusPort,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private sanitizeUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: !!user.emailVerifiedAt,
      reputationScore: user.reputationScore,
      locale: user.locale,
    };
  }

  async register(input: { email: string; password: string; username: string }) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { profile: { username: input.username } }] },
      include: { profile: true },
    });
    if (existing) {
      throw DomainError.conflict('Email or username already in use');
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const userId = newId();

    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: input.email,
        passwordHash,
        profile: {
          create: { id: newId(), username: input.username, displayName: input.username },
        },
      },
    });

    await this.issueEmailVerification(user.id, user.email);
    await this.bus.publish(new UserRegisteredEvent({ userId: user.id }));

    return this.sanitizeUser(user);
  }

  private async issueEmailVerification(userId: string, email: string): Promise<void> {
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.emailVerificationToken.create({
      data: {
        id: newId(),
        userId,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    await this.mailer.sendEmailVerification(email, raw);
  }

  async verifyEmail(token: string): Promise<void> {
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw DomainError.validation('Invalid or expired verification token');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
  }

  async login(
    input: { email: string; password: string },
    ctx: RequestContext,
  ): Promise<TokenPair & { user: ReturnType<AuthService['sanitizeUser']> }> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    // Constant-ish work even when user is missing, to reduce enumeration signal.
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$invalidsaltinvalid$invalidhash';
    const ok = await argon2.verify(hash, input.password).catch(() => false);

    if (!user || !user.passwordHash || !ok) {
      throw DomainError.unauthorized('Invalid credentials');
    }
    if (user.status === UserStatus.BANNED || user.status === UserStatus.DELETED) {
      throw DomainError.forbidden('Account is not active');
    }

    const pair = await this.tokens.issuePair(user, ctx);
    return { ...pair, user: this.sanitizeUser(user) };
  }

  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken, ctx);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.tokens.revoke(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always return success to avoid account enumeration.
    if (!user) return;
    const raw = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: {
        id: newId(),
        userId: user.id,
        tokenHash: this.hash(raw),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    await this.mailer.sendPasswordReset(email, raw);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hash(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw DomainError.validation('Invalid or expired reset token');
    }
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
    ]);
    // Invalidate all existing sessions after a password reset.
    await this.tokens.revokeAllForUser(record.userId);
  }

  async oauthLogin(
    provider: OAuthProvider,
    token: string,
    username: string | undefined,
    ctx: RequestContext,
  ): Promise<TokenPair & { user: ReturnType<AuthService['sanitizeUser']>; needsUsername: boolean }> {
    const identity =
      provider === OAuthProvider.GOOGLE
        ? await this.oauth.verifyGoogle(token)
        : await this.oauth.verifyApple(token);

    const account = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
        },
      },
      include: { user: true },
    });

    let user = account?.user ?? null;
    let needsUsername = false;

    if (!user && identity.email) {
      user = await this.prisma.user.findUnique({ where: { email: identity.email } });
    }

    if (!user) {
      // First-time social signup requires a username.
      if (!username) {
        return {
          accessToken: '',
          refreshToken: '',
          user: null as never,
          needsUsername: true,
        };
      }
      const taken = await this.prisma.profile.findUnique({ where: { username } });
      if (taken) throw DomainError.conflict('Username already in use');

      user = await this.prisma.user.create({
        data: {
          id: newId(),
          email: identity.email ?? `${identity.providerAccountId}@${provider.toLowerCase()}.oauth`,
          emailVerifiedAt: identity.emailVerified ? new Date() : null,
          profile: { create: { id: newId(), username, displayName: username } },
        },
      });
      needsUsername = false;
    }

    if (!account) {
      await this.prisma.oAuthAccount.create({
        data: {
          id: newId(),
          userId: user.id,
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
        },
      });
    }

    if (user.status === UserStatus.BANNED || user.status === UserStatus.DELETED) {
      throw DomainError.forbidden('Account is not active');
    }

    const pair = await this.tokens.issuePair(user, ctx);
    return { ...pair, user: this.sanitizeUser(user), needsUsername };
  }
}
