/** Normalized error mirroring the backend RFC 7807 problem+json shape. */
export class ApiError extends Error {
  readonly status: number;
  readonly type: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(params: {
    status: number;
    type: string;
    detail: string;
    fieldErrors?: Record<string, string>;
  }) {
    super(params.detail);
    this.name = 'ApiError';
    this.status = params.status;
    this.type = params.type;
    this.fieldErrors = params.fieldErrors;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
}
