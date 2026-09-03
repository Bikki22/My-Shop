import { clientEnv } from "@/config/env";
import { ApiError } from "./api-error";

/**
 * The envelope every endpoint on the Express server responds with:
 * `{ success: true, data: ... }`.
 */
interface ApiSuccess<T> {
  success: true;
  data: T;
}

/**
 * Supplies the Clerk session token for a request. It's async and nullable
 * because both callers (`auth().getToken` on the server, `useAuth().getToken`
 * in the browser) are async and return `null` for signed-out visitors.
 */
export type TokenProvider = () => Promise<string | null>;

export interface RequestOptions extends Omit<RequestInit, "body" | "method"> {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Serialized as JSON unless it's already a `FormData`/`BodyInit`. */
  body?: unknown;
  /** Appended to the URL, skipping `undefined`/`null` values. */
  searchParams?: Record<string, string | number | boolean | undefined | null>;
  /** Omit to send the request unauthenticated. */
  getToken?: TokenProvider;
}

const API_PREFIX = "/api/v1";

const buildUrl = (
  path: string,
  searchParams: RequestOptions["searchParams"],
): string => {
  const url = new URL(
    `${API_PREFIX}${path.startsWith("/") ? path : `/${path}`}`,
    clientEnv.apiUrl,
  );

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
};

const isBodyInit = (body: unknown): body is BodyInit =>
  typeof body === "string" ||
  body instanceof FormData ||
  body instanceof URLSearchParams ||
  body instanceof Blob ||
  body instanceof ArrayBuffer;

/**
 * The one place that talks to the Express API.
 *
 * Unwraps the `{ success, data }` envelope so callers get the payload
 * directly, and turns any non-2xx response into a thrown `ApiError`.
 */
export async function apiRequest<T>(
  path: string,
  { method = "GET", body, searchParams, getToken, ...init }: RequestOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  // Let the browser set the multipart boundary itself — overriding
  // Content-Type on a FormData body produces an unparseable request.
  const serializedBody = isBodyInit(body) ? body : JSON.stringify(body);
  if (body !== undefined && !isBodyInit(body)) {
    headers.set("Content-Type", "application/json");
  }

  const token = await getToken?.();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, searchParams), {
      ...init,
      method,
      headers,
      body: body === undefined ? undefined : serializedBody,
    });
  } catch {
    // fetch only rejects on network/CORS failures; surface those as an
    // ApiError too so callers have a single error type to handle.
    throw new ApiError(0, "Could not reach the server. Is the API running?", []);
  }

  if (!response.ok) {
    throw await ApiError.fromResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}
