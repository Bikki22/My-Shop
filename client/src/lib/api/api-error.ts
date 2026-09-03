/** Mirrors `ApiErrorBody` from the Express server's `utils/ApiError.ts`. */
export interface ApiErrorDetail {
  field: string;
  message: string;
}

interface ApiErrorBody {
  success: false;
  message: string;
  errors?: ApiErrorDetail[];
}

const isApiErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { message?: unknown }).message === "string";

/**
 * A failed API call, carrying the server's status and field-level details so
 * forms can map `errors[].field` onto their inputs.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly details: readonly ApiErrorDetail[];

  constructor(
    status: number,
    message: string,
    details: readonly ApiErrorDetail[] = [],
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  /** Builds an ApiError from a non-2xx `Response`, tolerating non-JSON bodies. */
  static async fromResponse(response: Response): Promise<ApiError> {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      // An HTML error page or empty body — fall back to the status text.
      return new ApiError(response.status, response.statusText || "Request failed");
    }

    if (isApiErrorBody(body)) {
      return new ApiError(response.status, body.message, body.errors ?? []);
    }
    return new ApiError(response.status, "Request failed");
  }
}

export const isApiError = (error: unknown): error is ApiError =>
  error instanceof ApiError;
