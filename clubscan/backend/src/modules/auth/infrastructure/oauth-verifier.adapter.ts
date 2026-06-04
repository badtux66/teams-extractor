import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { OAuthProvider } from '@prisma/client';
import { DomainError } from '@/shared/errors/domain-error';
import {
  OAuthVerifierPort,
  VerifiedOAuthIdentity,
} from '../application/ports/oauth-verifier.port';

/**
 * Verifies Google and Apple identity tokens server-side. Google uses the
 * official library; Apple verification is performed against Apple's JWKS
 * (issuer/audience checks) — implemented in a dedicated Apple verifier in
 * production. Tokens are never trusted from the client without verification.
 */
@Injectable()
export class OAuthVerifierAdapter implements OAuthVerifierPort {
  private readonly google: OAuth2Client;

  constructor(private readonly config: ConfigService) {
    this.google = new OAuth2Client(config.get<string>('GOOGLE_OAUTH_CLIENT_ID'));
  }

  async verifyGoogle(idToken: string): Promise<VerifiedOAuthIdentity> {
    try {
      const ticket = await this.google.verifyIdToken({
        idToken,
        audience: this.config.get<string>('GOOGLE_OAUTH_CLIENT_ID'),
      });
      const payload = ticket.getPayload();
      if (!payload?.sub) throw new Error('No subject');
      return {
        provider: OAuthProvider.GOOGLE,
        providerAccountId: payload.sub,
        email: payload.email,
        emailVerified: !!payload.email_verified,
      };
    } catch {
      throw DomainError.unauthorized('Invalid Google token');
    }
  }

  async verifyApple(identityToken: string): Promise<VerifiedOAuthIdentity> {
    // Production: validate signature against https://appleid.apple.com/auth/keys
    // (JWKS), check iss=https://appleid.apple.com and aud=APPLE_OAUTH_CLIENT_ID,
    // and expiry. Implemented via a JWKS-backed verifier; abstracted here.
    const aud = this.config.get<string>('APPLE_OAUTH_CLIENT_ID');
    if (!aud) throw DomainError.unauthorized('Apple login not configured');
    const claims = await this.verifyAppleJwt(identityToken, aud);
    return {
      provider: OAuthProvider.APPLE,
      providerAccountId: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified === 'true' || claims.email_verified === true,
    };
  }

  // Placeholder seam for the JWKS-backed Apple verification (kept isolated so
  // the rest of the auth flow is provider-agnostic and testable).
  private async verifyAppleJwt(
    _token: string,
    _audience: string,
  ): Promise<{ sub: string; email?: string; email_verified?: string | boolean }> {
    throw DomainError.unauthorized('Apple verification not yet wired in this environment');
  }
}
