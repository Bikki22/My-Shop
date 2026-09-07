import "server-only";

import { cache } from "react";
import { emptyPage, isApiError, type Paginated } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { getProductRequest, listProductsRequest } from "../api/product.api";
import type { Product, ProductFilters, ProductListItem } from "../types";

export interface ProductListResult {
  page: Paginated<ProductListItem>;
  /** Set when the catalogue could not be read; `page` is empty then. */
  error: string | null;
}

/**
 * Reads a page of the catalogue for a Server Component.
 *
 * The catalogue page itself no longer goes through this — it prefetches into
 * the query cache instead (see `server/prefetch.ts`), so the grid can page
 * without tearing down. This remains for server-only reads that never become
 * client state, like the "more in this category" strip on a product page.
 *
 * A failed request is returned rather than thrown: an unreachable API should
 * degrade a related-products strip to nothing, not blow the whole route up to
 * the error boundary.
 */
export async function listProducts(
  filters: ProductFilters,
): Promise<ProductListResult> {
  const { path, ...options } = listProductsRequest(filters);

  try {
    const page = await serverApi<Paginated<ProductListItem>>(path, options);
    return { page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return {
        page: emptyPage<ProductListItem>(filters.limit),
        error: caught.message,
      };
    }
    throw caught;
  }
}

/**
 * A single listing. Returns `null` for a product that does not exist (or was
 * soft-deleted) so the page can call `notFound()`; every other failure throws.
 *
 * `cache()`d because the product page reads it twice — once in
 * `generateMetadata` and once in the component — and `serverApi` sends
 * `no-store`, so without this each render is two identical round trips. Same
 * arrangement as `getCurrentUser`.
 */
export const getProduct = cache(async (id: string): Promise<Product | null> => {
  const { path, ...options } = getProductRequest(id);

  try {
    return await serverApi<Product>(path, options);
  } catch (caught) {
    if (isApiError(caught) && (caught.isNotFound || caught.status === 400)) {
      // 400 covers a malformed id — `/products/not-an-id` is a wrong URL, not
      // a server fault.
      return null;
    }
    throw caught;
  }
});
