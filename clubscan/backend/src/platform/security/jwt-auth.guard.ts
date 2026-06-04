import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserStatus } from '@prisma/client';
import { DomainError } from '@/shared/errors/domain-error';
import { AccessTokenClaims, AuthenticatedUser } from './auth.types';
import { IS_PUBLIC_KEY } from './decorators';

/**
 * Verifies the Bearer access token (stateless), rejects banned/deleted users,
 * and attaches `req.user`. Routes marked @Public() bypass authentication.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(req);
    if (!token) throw DomainError.unauthorized('Missing access token');

    let claims: AccessTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessTokenClaims>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch {
      throw DomainError.unauthorized('Invalid or expired access token');
    }

    if (claims.status === UserStatus.BANNED || claims.status === UserStatus.DELETED) {
      throw DomainError.forbidden('Account is not active');
    }

    const user: AuthenticatedUser = {
      id: claims.sub,
      role: claims.role,
      status: claims.status,
      sessionId: claims.sid,
    };
    (req as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
