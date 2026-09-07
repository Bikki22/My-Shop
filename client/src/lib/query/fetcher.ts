import type { apiRequest } from "@/lib/api";

/**
 * Anything that can talk to the API — `useApi()` in the browser, `serverApi`
 * in a Server Component. Both have this shape.
 *
 * It exists so one set of query options can describe both environments. The
 * two authenticate differently (the browser needs a Clerk token fetched per
 * request from `useAuth()`; the server reads it from `auth()`), so the
 * *fetcher* is passed in rather than closed over — while the query **key**
 * stays identical, which is what makes server prefetch and client hydration
 * line up.
 */
export type Fetcher = <T>(
  path: string,
  options?: Parameters<typeof apiRequest>[1],
) => Promise<T>;
