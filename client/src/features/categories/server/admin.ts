import "server-only";

import { emptyResultPage, isApiError, type Page } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { listCategoriesAdminRequest } from "../api/category.api";
import type { Category } from "../types";

export interface CategoriesResult {
  page: Page<Category>;
  error: string | null;
}

/**
 * The whole tree, active and inactive, for the staff screen.
 *
 * `isActive` is passed explicitly rather than omitted: the endpoint defaults
 * it to `true`, so leaving it out would hide every inactive category from the
 * one screen meant to bring them back.
 */
export async function listCategoriesForAdmin(filters: {
  page: number;
  limit: number;
  search?: string;
  isActive?: boolean;
}): Promise<CategoriesResult> {
  const { path, ...options } = listCategoriesAdminRequest(filters);

  try {
    const page = await serverApi<Page<Category>>(path, options);
    return { page, error: null };
  } catch (caught) {
    if (isApiError(caught)) {
      return {
        page: emptyResultPage<Category>(filters.limit),
        error: caught.message,
      };
    }
    throw caught;
  }
}
