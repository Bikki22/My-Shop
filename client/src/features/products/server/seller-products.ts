import "server-only";

import { emptyPage, isApiError, type Paginated } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { getProductRequest, listMyProductsRequest } from "../api/product.api";
import type { Product, ProductListItem } from "../types";

export interface SellerProductsResult {
  page: Paginated<ProductListItem>;
  /** Set when the list could not be read; `page` is empty then. */
  error: string | null;
}

/**
 * A page of the merchant's own listings.
 *
 * Reads the catalogue's `?vendor=` facet rather than a private endpoint —
 * see `listMyProductsRequest` for why that is both sufficient and safe.
 *
 * A failed request is returned rather than thrown, the same contract
 * `listMyOrders` keeps: the page's search box and its "New listing" button
 * should survive an unreachable API.
 */
export async function listMyProducts(
  vendorId: string,
  filters: { page: number; limit: number; search?: string },
): Promise<SellerProductsResult> {
  const { path, ...options } = listMyProductsRequest(vendorId, filters);

  try {
    const page = await serverApi<Paginated<ProductListItem>>(path, options);
    return { page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return { page: emptyPage(filters.limit), error: caught.message };
    }
    throw caught;
  }
}

/**
 * One listing for its edit screen, or `null` when it does not exist.
 *
 * Ownership is *not* checked here — `GET /products/:id` is public, so this
 * would happily return someone else's listing. That is safe because every
 * write the edit screen can make is authorised on the server against the
 * caller's own shop: a merchant who guesses another shop's id gets a form
 * whose Save button returns 403. Hiding the read as well would need an
 * endpoint that does not exist.
 */
export async function getSellerProduct(id: string): Promise<Product | null> {
  const { path, ...options } = getProductRequest(id);

  try {
    return await serverApi<Product>(path, options);
  } catch (caught) {
    if (isApiError(caught) && (caught.isNotFound || caught.status === 400)) {
      return null;
    }
    throw caught;
  }
}
