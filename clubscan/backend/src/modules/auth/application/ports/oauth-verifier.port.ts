import { OAuthProvider } from '@prisma/client';

export const OAUTH_VERIFIER = Symbol('OAUTH_VERIFIER');

export interface VerifiedOAuthIdentity {
  provider: OAuthProvider;
  providerAccountId: string;
  email?: string;
  emailVerified: boolean;
}

/** Verifies third-party identity tokens server-side (never trust the client). */
export interface OAuthVerifierPort {
  verifyGoogle(idToken: string): Promise<VerifiedOAuthIdentity>;
  verifyApple(identityToken: string): Promise<VerifiedOAuthIdentity>;
}
