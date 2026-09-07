import "server-only";

import type { QueryClient } from "@tanstack/react-query";
import { serverApi } from "@/lib/api/server";
import { categoryCache } from "../category-cache";

/**
 * Fills the query cache with the category tree, server-side.
 *
 * Awaited, and cheap to await: the list is small, and the filter rail cannot
 * render its category options without it. Same failure behaviour as
 * `prefetchProducts` — a failed read is left as an error state rather than a
 * dehydrated rejection, and `useCategoriesQuery` degrades it to an empty list.
 */
export async function prefetchCategories(
  queryClient: QueryClient,
): Promise<void> {
  await queryClient.prefetchQuery(categoryCache.listOptions(serverApi));
}
