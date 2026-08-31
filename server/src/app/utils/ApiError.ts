export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  success: false;
  message: string;
  errors?: ApiErrorDetail[];
}

/**
 * An error that carries the HTTP status it should be rendered with.
 * Anything thrown that is *not* an ApiError is treated as a bug and
 * reported as a generic 500, so internals never leak to the client.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details: readonly ApiErrorDetail[];

  constructor(
    statusCode: number,
    message: string,
    details: readonly ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: readonly ApiErrorDetail[]) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message);
  }

  static notFound(message = "Resource not found") {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }

  /** The client-facing shape of this error. */
  toJSON(): ApiErrorBody {
    const body: ApiErrorBody = { success: false, message: this.message };
    if (this.details.length > 0) {
      body.errors = [...this.details];
    }
    return body;
  }
}
