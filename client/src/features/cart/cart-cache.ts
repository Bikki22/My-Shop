import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Fetcher } from "@/lib/query/fetcher";
import { getCartCountsRequest, getCartRequest } from "./api/cart.api";
import type { Cart, CartCounts } from "./types";

/**
 * The cart's cache contract: the keys, and the options built from them.
 *
 * Keys live here and nowhere else. A server prefetch and a browser
 * `useQuery` must agree on the key exactly or hydration silently misses and
 * the browser refetches — keeping both call sites on this one module is what
 * makes that impossible to get wrong.
 *
 * The options take the fetcher as an argument rather than closing over one,
 * because the two environments authenticate differently: the browser needs a
 * Clerk token fetched per request from `useAuth()`, the server reads it from
 * `auth()`. The key is unaffected, which is the whole point.
 */
export const cartCache = {
  /** Everything cart-shaped, for invalidating in one call. */
  all: ["cart"] as const,
  detail: () => ["cart", "detail"] as const,
  counts: () => ["cart", "counts"] as const,

  detailOptions: (fetcher: Fetcher) =>
    queryOptions({
      queryKey: cartCache.detail(),
      queryFn: () => {
        const { path, ...options } = getCartRequest();
        return fetcher<Cart>(path, options);
      },
    }),

  countsOptions: (fetcher: Fetcher) =>
    queryOptions({
      queryKey: cartCache.counts(),
      queryFn: () => {
        const { path, ...options } = getCartCountsRequest();
        return fetcher<CartCounts>(path, options);
      },
    }),
} as const;

/** The counts the header badge shows, derived from a full cart. */
export const countsOf = (cart: Cart): CartCounts => ({
  itemCount: cart.summary.itemCount,
  totalQuantity: cart.summary.totalQuantity,
});

/**
 * Writes a known cart into both entries.
 *
 * The badge reads `counts` and the page reads `detail`, so anything holding a
 * full cart should fill in both — otherwise a page that just fetched the whole
 * cart still has its header firing a second request for two numbers it already
 * has. Used by the server prefetch and by every cart mutation's response.
 */
export function seedCart(
  queryClient: Pick<QueryClient, "setQueryData">,
  cart: Cart,
): void {
  queryClient.setQueryData(cartCache.detail(), cart);
  queryClient.setQueryData(cartCache.counts(), countsOf(cart));
}
