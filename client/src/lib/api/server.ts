import "server-only";

import { auth } from "@clerk/nextjs/server";
import { apiRequest, type RequestOptions } from "./http";

/**
 * Calls the Express API from a Server Component, Route Handler or Server
 * Action, forwarding the caller's Clerk session token.
 *
 * Requests are `no-store` by default: these responses are per-user, and
 * caching them would serve one account's data to another.
 */
export async function serverApi<T>(
  path: string,
  options: Omit<RequestOptions, "getToken"> = {},
): Promise<T> {
  const { getToken } = await auth();

  return apiRequest<T>(path, {
    cache: "no-store",
    ...options,
    getToken,
  });
}
