import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import { serverApi } from "@/lib/api/server";
import { productCache } from "../product-cache";
import type { ProductFilters } from "../types";

/**
 * Fills the query cache with a page of the catalogue, server-side.
 *
 * Awaited rather than streamed as a pending query, for the reason
 * `prefetchCart` documents: a dehydrated *pending* query that rejects surfaces
 * as a client-side render error instead of the component's own "unavailable"
 * panel. `prefetchQuery` resolves either way — a failure leaves the query in an
 * error state, which is not dehydrated, so the browser retries and the grid
 * reports it itself.
 *
 * Streaming is not lost by awaiting: the caller puts this below a `<Suspense>`
 * boundary, so the page's header, search box and filter rail paint first and
 * the grid arrives when the API answers.
 *
 * `queryFn` is overridden because the browser's fetcher is a hook bound to
 * `useAuth()`, which cannot run here. Only the function differs — the key comes
 * from `productCache`, which is what makes hydration line up.
 */
export async function prefetchProducts(
  queryClient: QueryClient,
  filters: ProductFilters,
): Promise<void> {
  await queryClient.prefetchQuery(productCache.listOptions(serverApi, filters));
}
