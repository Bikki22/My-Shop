import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import { serverApi } from "@/lib/api/server";
import { cartCache, seedCart } from "../cart-cache";
import { getCartRequest } from "../api/cart.api";
import type { Cart } from "../types";

/**
 * Fills the query cache with the cart, server-side, so the first paint has it.
 *
 * **Awaited, deliberately.** The documented pattern is to leave the query
 * pending and let the dehydrated state carry the in-flight promise to the
 * browser, which avoids blocking the render. Two reasons not to here:
 *
 * 1. There is nothing to paint without it. The cart page renders a title, a
 *    step rail and then the cart — streaming buys no earlier useful frame.
 * 2. A pending query that *rejects* after dehydration surfaces as a
 *    client-side render error, which is not how a failed cart read should be
 *    reported. `prefetchQuery` instead resolves either way: a failure leaves
 *    the query in an error state, which `defaultShouldDehydrateQuery` declines
 *    to dehydrate, so the browser retries and `CartView` renders its own
 *    "could not load your cart" panel.
 *
 * `queryFn` is overridden because the browser's fetcher is a hook bound to
 * `useAuth()`, which cannot run here. Only the function differs — the key comes
 * from `cartCache`, which is what makes hydration line up.
 */
export async function prefetchCart(queryClient: QueryClient): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: cartCache.detail(),
    queryFn: () => {
      const { path, ...options } = getCartRequest();
      return serverApi<Cart>(path, options);
    },
  });

  // The header's badge reads the counts entry, so fill it from the cart just
  // fetched — otherwise this page ships a full cart and the header still asks
  // the API for two numbers it already has. Absent on a failed read, in which
  // case the badge falls back to its own request.
  const cart = queryClient.getQueryData<Cart>(cartCache.detail());
  if (cart) seedCart(queryClient, cart);
}
