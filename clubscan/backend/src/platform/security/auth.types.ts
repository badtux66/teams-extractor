import { UserRole, UserStatus } from '@prisma/client';

/** Decoded access-token claims attached to the request as `req.user`. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  status: UserStatus;
  sessionId: string;
}

export interface AccessTokenClaims {
  sub: string;
  role: UserRole;
  status: UserStatus;
  sid: string;
}
