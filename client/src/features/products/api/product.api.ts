import type { RequestOptions } from "@/lib/api";
import { toProductSearchParams } from "../lib/product-filters";
import type { ProductFilters, ProductInput } from "../types";

/**
 * Endpoint paths for the server's `/api/v1/products` router, kept in one
 * place so a backend route rename is a single-file change here.
 */
export const productEndpoints = {
  list: "/products",
  byId: (id: string) => `/products/${id}`,
  byCategory: (categoryId: string) => `/products/category/${categoryId}`,
  byShop: (slug: string) => `/products/shop/${slug}`,
} as const;

type Request = { path: string } & RequestOptions;

/**
 * The catalogue read.
 *
 * `unwrap: false` because this endpoint answers with the page envelope at
 * the top level (`{ success, docs, totalDocs, ... }`) instead of nesting
 * the payload under `data`.
 */
export const listProductsRequest = (filters: ProductFilters): Request => ({
  path: productEndpoints.list,
  method: "GET",
  unwrap: false,
  searchParams: {
    ...Object.fromEntries(toProductSearchParams(filters)),
    // Always explicit: the URL omits page 1 and the default limit, but the
    // request must still ask for a page the size the grid was built for.
    page: filters.page,
    limit: filters.limit,
  },
});

export const getProductRequest = (id: string): Request => ({
  path: productEndpoints.byId(id),
  method: "GET",
});

/**
 * A merchant's own listings.
 *
 * There is no "my products" endpoint on the server — the catalogue's own
 * `?vendor=` facet answers it, and the merchant's shop id comes from
 * `GET /vendors/me`. Reusing the public list rather than adding a private
 * one keeps one pipeline to maintain, and it is safe because the filter only
 * narrows what is already public.
 *
 * The catalogue's soft-delete scope is the only filter applied, so this
 * includes listings that are out of stock — which is exactly what a shop
 * needs to see and a shopper does not.
 */
export const listMyProductsRequest = (
  vendorId: string,
  { page, limit, search }: { page: number; limit: number; search?: string },
): Request => ({
  path: productEndpoints.list,
  method: "GET",
  unwrap: false,
  searchParams: { vendor: vendorId, page, limit, search, sort: "newest" },
});

/**
 * Creating and updating a listing.
 *
 * No `vendor` field on either: the server resolves the shop from the caller,
 * because a `vendorId` a client could send is a client choosing whose shop to
 * sell from and whose bank account the money lands in.
 */
export const createProductRequest = (input: ProductInput): Request => ({
  path: productEndpoints.list,
  method: "POST",
  body: input,
});

export const updateProductRequest = (
  id: string,
  input: Partial<ProductInput>,
): Request => ({
  path: productEndpoints.byId(id),
  method: "PATCH",
  body: input,
});

/** Soft-deletes the listing. The server keeps the row for order history. */
export const deleteProductRequest = (id: string): Request => ({
  path: productEndpoints.byId(id),
  method: "DELETE",
});

/**
 * Appends photos to an existing listing.
 *
 * `FormData`, so `apiRequest` leaves the `Content-Type` unset and lets the
 * browser write its own multipart boundary — setting it by hand produces an
 * unparseable request.
 */
export const uploadProductImagesRequest = (
  id: string,
  files: readonly File[],
): Request => {
  const body = new FormData();
  for (const file of files) {
    body.append("images", file);
  }

  return { path: `${productEndpoints.byId(id)}/images`, method: "POST", body };
};

/** Drops one photo, and deletes the asset from Cloudinary behind it. */
export const removeProductImageRequest = (
  id: string,
  imageUrl: string,
): Request => ({
  path: `${productEndpoints.byId(id)}/images/remove`,
  method: "PATCH",
  body: { imageUrl },
});
