import "server-only";

import { dehydrate, type QueryClient } from "@tanstack/react-query";
import { makeQueryClient } from "./client";

/**
 * A query client for one Server Component render, and the dehydrated state to
 * hand to `<HydrationBoundary>`.
 *
 * The point of prefetching on the server is that the first paint already has
 * the data — a cart rendered from a browser fetch would flash a skeleton on
 * every load. After hydration TanStack Query owns the browser copy, so this
 * runs once per request and then gets out of the way.
 *
 * Deliberately a fresh client each call rather than a cached one: the
 * dehydrated state is serialized into the response, and reusing a client
 * across requests would leak one shopper's cart into another's HTML.
 */
export function createServerQueryClient(): QueryClient {
  return makeQueryClient();
}

/** `dehydrate` with the client's configured `shouldDehydrateQuery`. */
export const dehydrateQueries = (queryClient: QueryClient) =>
  dehydrate(queryClient);
