import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { DomainError } from '@/shared/errors/domain-error';

interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
  errors?: Array<{ path: string; message: string }>;
  traceId?: string;
}

/**
 * Maps every thrown error to an RFC 7807 problem+json response.
 * Domain errors and Zod errors are translated without leaking internals;
 * unexpected errors return 500 with a trace id (and are reported to Sentry).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    const traceId = (req.headers['x-request-id'] as string) ?? undefined;

    const problem = this.toProblem(exception, req.url, traceId);

    if (problem.status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} -> ${problem.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res.status(problem.status).type('application/problem+json').json(problem);
  }

  private toProblem(exception: unknown, instance: string, traceId?: string): ProblemDetails {
    if (exception instanceof DomainError) {
      return {
        type: `https://clubscan.app/errors/${exception.code.toLowerCase()}`,
        title: exception.code,
        status: exception.httpStatus,
        detail: exception.message,
        instance,
        errors: Array.isArray(exception.details)
          ? (exception.details as Array<{ path: string; message: string }>)
          : undefined,
        traceId,
      };
    }

    if (exception instanceof ZodError) {
      return {
        type: 'https://clubscan.app/errors/validation',
        title: 'Validation failed',
        status: 422,
        detail: 'Request validation failed',
        instance,
        errors: exception.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        traceId,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const detail =
        typeof response === 'string'
          ? response
          : ((response as Record<string, unknown>)?.message as string) ?? exception.message;
      return {
        type: `https://clubscan.app/errors/http-${status}`,
        title: exception.name,
        status,
        detail: Array.isArray(detail) ? detail.join('; ') : detail,
        instance,
        traceId,
      };
    }

    return {
      type: 'https://clubscan.app/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred',
      instance,
      traceId,
    };
  }
}
