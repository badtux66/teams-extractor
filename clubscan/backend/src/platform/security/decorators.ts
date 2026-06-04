import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marks a route as not requiring authentication. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Restricts a route to the given roles (RBAC). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const AUDIT_KEY = 'audit';
/** Records an immutable audit log entry for a privileged handler. */
export const Audit = (action: string) => SetMetadata(AUDIT_KEY, action);

/** Injects the authenticated user (or a single property of it). */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const user = ctx.switchToHttp().getRequest().user as AuthenticatedUser | undefined;
    return data && user ? user[data] : user;
  },
);
