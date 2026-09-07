import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { Paginated } from "@/lib/api";
import type { Fetcher } from "@/lib/query/fetcher";
import { getProductRequest, listProductsRequest } from "./api/product.api";
import type { Product, ProductFilters, ProductListItem } from "./types";

/**
 * The catalogue's cache contract: the keys, and the options built from them.
 *
 * Keys live here and nowhere else. A server prefetch and a browser `useQuery`
 * must agree on the key exactly or hydration silently misses and the browser
 * refetches — keeping both call sites on this one module is what makes that
 * impossible to get wrong.
 */
export const productCache = {
  /** Everything catalogue-shaped, for invalidating in one call. */
  all: ["products"] as const,

  /**
   * Keyed on the **query params actually sent**, not on the filter object.
   *
   * Derived from the request builder so the key and the fetch can never
   * diverge: two filter objects that produce the same request are the same
   * cache entry, which is what makes "clear the search box" land back on the
   * page the visitor already had. TanStack hashes the object deterministically,
   * so key order does not matter.
   */
  list: (filters: ProductFilters) =>
    ["products", "list", listProductsRequest(filters).searchParams] as const,

  detail: (id: string) => ["products", "detail", id] as const,

  listOptions: (fetcher: Fetcher, filters: ProductFilters) =>
    queryOptions({
      queryKey: productCache.list(filters),
      queryFn: () => {
        const { path, ...options } = listProductsRequest(filters);
        return fetcher<Paginated<ProductListItem>>(path, options);
      },
      /**
       * The reason this feature is worth putting on TanStack Query at all.
       *
       * Paging or refining keeps the previous result on screen while the new
       * one loads, instead of tearing the grid down to a skeleton and back.
       * Callers dim it via `isPlaceholderData` so it reads as "catching up"
       * rather than as the answer.
       */
      placeholderData: keepPreviousData,
    }),

  detailOptions: (fetcher: Fetcher, id: string) =>
    queryOptions({
      queryKey: productCache.detail(id),
      queryFn: () => {
        const { path, ...options } = getProductRequest(id);
        return fetcher<Product>(path, options);
      },
    }),
} as const;
