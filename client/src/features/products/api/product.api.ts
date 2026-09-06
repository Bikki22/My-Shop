import type { RequestOptions } from "@/lib/api";
import { toProductSearchParams } from "../lib/product-filters";
import type { ProductFilters } from "../types";

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
