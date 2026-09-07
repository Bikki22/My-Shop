import { QueryClient, defaultShouldDehydrateQuery } from "@tanstack/react-query";

/**
 * One query client per server render, one shared client in the browser.
 *
 * The split matters: a module-level client on the server would be shared
 * between concurrent requests, so one user's cart could be served into
 * another's render. In the browser the opposite is wanted — a single client
 * that survives re-renders, which is what lets the header badge and the cart
 * page read the same cache entry instead of fetching twice.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        /**
         * Long enough that a hydrated page does not immediately refetch what
         * the server just sent, short enough that coming back to a tab shows
         * current stock. Cart mutations write their response straight into
         * the cache, so this only governs background freshness.
         */
        staleTime: 30_000,
        retry: (failureCount, error) => {
          // A 4xx is an answer, not a hiccup: retrying "not enough stock" or
          // "unauthorized" just delays showing the user what happened.
          const status = (error as { status?: number }).status;
          if (typeof status === "number" && status >= 400 && status < 500) {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        // Mutations are user-initiated and mostly non-idempotent (adding to a
        // cart, placing an order) — an automatic retry could place two.
        retry: false,
      },
      dehydrate: {
        // Lets a Server Component start a fetch without awaiting it and still
        // hand the in-flight promise to the client. Without this, a pending
        // query is dropped and the browser refetches from scratch.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
