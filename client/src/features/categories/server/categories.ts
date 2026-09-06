import "server-only";

import { isApiError } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { listCategoriesRequest } from "../api/category.api";
import type { Category } from "../types";

/**
 * The categories offered in the filter sidebar.
 *
 * Failures come back as an empty list: the catalogue is still perfectly
 * usable with every other facet, so a categories outage should not take
 * the products page with it.
 */
export async function listCategories(): Promise<Category[]> {
  const { path, ...options } = listCategoriesRequest();

  try {
    return await serverApi<Category[]>(path, options);
  } catch (caught) {
    if (isApiError(caught)) return [];
    throw caught;
  }
}
