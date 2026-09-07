import type { RequestOptions } from "@/lib/api";
import type { CategoryInput } from "../types";

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

/**
 * The staff view of the tree, which unlike the shopper's can see inactive
 * categories — that is the whole point of the screen.
 */
export const listCategoriesAdminRequest = (filters: {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}): { path: string } & RequestOptions => ({
  path: categoryEndpoints.list,
  method: "GET",
  searchParams: {
    page: filters.page,
    limit: filters.limit,
    sort: "name_asc",
    search: filters.search || undefined,
    // Explicitly `false` rather than omitted: the server defaults this to
    // `true`, so leaving it out would silently hide every inactive category
    // from the one screen meant to manage them.
    isActive: filters.isActive,
  },
});

export const createCategoryRequest = (
  input: CategoryInput,
): { path: string } & RequestOptions => ({
  path: categoryEndpoints.list,
  method: "POST",
  body: input,
});

export const updateCategoryRequest = (
  id: string,
  input: Partial<CategoryInput>,
): { path: string } & RequestOptions => ({
  path: categoryEndpoints.byId(id),
  method: "PATCH",
  body: input,
});

/** Soft-deletes it; products already filed under it keep their reference. */
export const deleteCategoryRequest = (
  id: string,
): { path: string } & RequestOptions => ({
  path: categoryEndpoints.byId(id),
  method: "DELETE",
});
