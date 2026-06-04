/**
 * Framework-agnostic domain/application errors. The HTTP layer
 * (AllExceptionsFilter) maps these to RFC 7807 problem+json responses,
 * so the domain never depends on HTTP.
 */
export type DomainErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'UNPROCESSABLE';

const STATUS: Record<DomainErrorCode, number> = {
  VALIDATION: 422,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  UNPROCESSABLE: 422,
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly httpStatus: number;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.httpStatus = STATUS[code];
    this.details = details;
  }

  static notFound(entity: string, id?: string): DomainError {
    return new DomainError('NOT_FOUND', `${entity}${id ? ` (${id})` : ''} not found`);
  }

  static conflict(message: string, details?: unknown): DomainError {
    return new DomainError('CONFLICT', message, details);
  }

  static forbidden(message = 'Forbidden'): DomainError {
    return new DomainError('FORBIDDEN', message);
  }

  static unauthorized(message = 'Unauthorized'): DomainError {
    return new DomainError('UNAUTHORIZED', message);
  }

  static validation(message: string, details?: unknown): DomainError {
    return new DomainError('VALIDATION', message, details);
  }
}
