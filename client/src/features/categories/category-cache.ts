import { queryOptions } from "@tanstack/react-query";
import type { Fetcher } from "@/lib/query/fetcher";
import { listCategoriesRequest } from "./api/category.api";
import type { Category } from "./types";

/**
 * The category tree's cache contract.
 *
 * Categories are the clearest case for a shared cache in the app: three
 * components want them (the filter rail, the filter sheet, the active-filter
 * chips), they are identical for every visitor, and they change about as often
 * as the shop's opening hours. Before this they were fetched on the server on
 * every catalogue render and prop-drilled to each one.
 */
export const categoryCache = {
  all: ["categories"] as const,
  list: () => ["categories", "list"] as const,

  listOptions: (fetcher: Fetcher) =>
    queryOptions({
      queryKey: categoryCache.list(),
      queryFn: () => {
        const { path, ...options } = listCategoriesRequest();
        return fetcher<Category[]>(path, options);
      },
      /**
       * An hour. The default 30s would refetch the same unchanging list on
       * every other navigation; a merchant adding a category does not need to
       * appear in a browsing visitor's sidebar within the minute.
       */
      staleTime: 60 * 60 * 1000,
    }),
} as const;
