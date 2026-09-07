"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api/client";
import { cartCache } from "../cart-cache";

/**
 * The shopper's cart, from the shared client cache.
 *
 * `useQuery` rather than `useSuspenseQuery`: the cart page and the header
 * badge both render their own inline states, and a Suspense boundary would
 * blank the whole panel on a background refetch instead of leaving the last
 * good cart on screen. It is hydrated from the server on the cart and
 * checkout pages, so `isPending` is only true where nothing prefetched it.
 */
export function useCartQuery() {
  const api = useApi();
  return useQuery(cartCache.detailOptions(api));
}

/**
 * Just the counts, for the header badge.
 *
 * A separate, much cheaper endpoint (`/cart/counts` does no product join), so
 * every page that renders the header does not pull a fully priced cart to
 * show one number. Cart mutations write both entries, so the two never
 * disagree.
 *
 * `enabled` keeps guests from firing a request that can only answer 401.
 */
export function useCartCountsQuery({ enabled }: { enabled: boolean }) {
  const api = useApi();
  return useQuery({ ...cartCache.countsOptions(api), enabled });
}
