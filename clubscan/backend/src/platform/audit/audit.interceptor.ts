import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import { AuthenticatedUser } from '@/platform/security/auth.types';

/**
 * Automatically records an audit log for routes annotated with @Audit('action_name')
 * or similar. For now, it just wraps requests and logs mutations.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    
    // Only log mutations for tamper-proof logging
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      const user = req.user as AuthenticatedUser | undefined;
      const ip = req.ip || req.socket?.remoteAddress;
      const action = `${req.method} ${req.route?.path || req.url}`;
      
      return next.handle().pipe(
        tap(() => {
          // Fire and forget audit log on success
          this.audit.record({
            actorId: user?.id,
            action,
            targetType: 'API_ENDPOINT',
            ip,
            metadata: {
              body: this.sanitize(req.body),
              query: req.query,
              params: req.params,
            },
          }).catch(console.error); // Do not block response on audit failure
        }),
      );
    }
    
    return next.handle();
  }

  private sanitize(body: any): any {
    if (!body) return body;
    const clone = { ...body };
    const secretKeys = ['password', 'token', 'refreshToken', 'secret'];
    for (const key of Object.keys(clone)) {
      if (secretKeys.some(sk => key.toLowerCase().includes(sk))) {
        clone[key] = '[REDACTED]';
      }
    }
    return clone;
  }
}
