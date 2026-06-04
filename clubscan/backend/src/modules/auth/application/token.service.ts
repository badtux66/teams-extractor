import { createHash, randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { PrismaService } from '@/platform/prisma/prisma.service';
import { DomainError } from '@/shared/errors/domain-error';
import { newId } from '@/shared/ids/uuid';
import { AccessTokenClaims } from '@/platform/security/auth.types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface IssueContext {
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Issues short-lived access JWTs and opaque, rotating refresh tokens.
 * Refresh tokens are stored hashed; rotation replaces the stored hash and
 * reuse of a consumed token revokes the whole token family (Phase 3 §4).
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private signAccess(user: Pick<User, 'id' | 'role' | 'status'>, sessionId: string): Promise<string> {
    const claims: AccessTokenClaims = {
      sub: user.id,
      role: user.role,
      status: user.status,
      sid: sessionId,
    };
    return this.jwt.signAsync(claims);
  }

  /** Issues a brand-new session (new token family). */
  async issuePair(
    user: Pick<User, 'id' | 'role' | 'status'>,
    ctx: IssueContext = {},
  ): Promise<TokenPair> {
    const sessionId = newId();
    const familyId = newId();
    const refreshToken = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        familyId,
        userId: user.id,
        deviceId: ctx.deviceId,
        refreshTokenHash: this.hash(refreshToken),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = await this.signAccess(user, sessionId);
    return { accessToken, refreshToken };
  }

  /** Rotates a refresh token; detects reuse and revokes the family on abuse. */
  async rotate(refreshToken: string, ctx: IssueContext = {}): Promise<TokenPair> {
    const tokenHash = this.hash(refreshToken);
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { user: true },
    });

    if (!session) {
      throw DomainError.unauthorized('Invalid refresh token');
    }

    // Reuse / expiry / revocation detection -> revoke the whole family.
    if (session.revokedAt || session.expiresAt < new Date()) {
      await this.prisma.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw DomainError.unauthorized('Refresh token expired or reused');
    }

    const newRefresh = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get<number>('JWT_REFRESH_TTL_DAYS', 30);

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: this.hash(newRefresh),
        ip: ctx.ip ?? session.ip,
        userAgent: ctx.userAgent ?? session.userAgent,
        expiresAt: new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = await this.signAccess(session.user, session.id);
    return { accessToken, refreshToken: newRefresh };
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: this.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
