"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api/client";
import { productCache } from "../product-cache";
import type { ProductFilters } from "../types";

/**
 * A page of the catalogue, from the shared client cache.
 *
 * The filters still come from the URL — that is what keeps a result set
 * shareable, reload-safe and crawlable, and it is why the page also renders
 * server-side. What the cache adds is the transition: a filter combination the
 * visitor has already seen renders from memory on the same frame, and one they
 * have not keeps the previous grid on screen (`placeholderData`) rather than
 * blanking to a skeleton.
 */
export function useProductsQuery(filters: ProductFilters) {
  const api = useApi();
  return useQuery(productCache.listOptions(api, filters));
}
