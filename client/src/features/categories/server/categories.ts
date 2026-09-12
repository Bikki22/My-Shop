import "server-only";

import { isApiError } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { listCategoriesRequest } from "../api/category.api";
import type { Category } from "../types";

/**
 * Reads the category tree for a Server Component that renders it directly.
 *
 * Separate from `prefetchCategories`, which fills the *client* query cache for
 * the catalogue's filter rail. The home page's category strip is never
 * refiltered on the client, so putting it through the cache would ship a
 * hydration payload nothing reads.
 *
 * A failed request comes back empty rather than thrown, like `listProducts`:
 * an unreachable API should cost the home page one strip, not the whole route.
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
