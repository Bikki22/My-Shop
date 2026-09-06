import type { RequestOptions } from "@/lib/api";

/** Endpoint paths for the server's `/api/v1/categories` router. */
export const categoryEndpoints = {
  list: "/categories",
  byId: (id: string) => `/categories/${id}`,
  bySlug: (slug: string) => `/categories/slug/${slug}`,
} as const;

/**
 * The active catalogue tree, alphabetical — what the filter sidebar lists.
 *
 * Unlike the product list, this endpoint does nest its payload under
 * `data` (with `pagination` alongside it), so the default unwrapping is
 * right and a plain array comes back.
 */
export const listCategoriesRequest = (
  limit = 100,
): { path: string } & RequestOptions => ({
  path: categoryEndpoints.list,
  method: "GET",
  searchParams: { limit, sort: "name_asc", isActive: true },
});
