import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { DomainError } from '@/shared/errors/domain-error';
import { AuthenticatedUser } from './auth.types';
import { ROLES_KEY } from './decorators';

/** RBAC. Role hierarchy: USER < MODERATOR < ADMIN < SUPER_ADMIN. */
const RANK: Record<UserRole, number> = {
  USER: 0,
  MODERATOR: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const user = context.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    if (!user) throw DomainError.unauthorized();

    const minRequired = Math.min(...required.map((r) => RANK[r]));
    if (RANK[user.role] < minRequired) {
      throw DomainError.forbidden('Insufficient role');
    }
    return true;
  }
}
