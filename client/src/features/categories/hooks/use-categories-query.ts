"use client";

import { useQuery } from "@tanstack/react-query";
import { useApi } from "@/lib/api/client";
import { categoryCache } from "../category-cache";
import type { Category } from "../types";

/**
 * The active category tree.
 *
 * Every consumer gets the same cache entry, so the filter rail, the filter
 * sheet and the active-filter chips share one request instead of being handed
 * the list as a prop from a server fetch that repeated on every render.
 *
 * Failures fall back to an empty list rather than being surfaced: the catalogue
 * is perfectly usable with every other facet, so a categories outage should
 * degrade one filter, not report an error across the page. Callers therefore
 * always get an array.
 */
export function useCategoriesQuery(): Category[] {
  const api = useApi();
  const { data } = useQuery(categoryCache.listOptions(api));
  return data ?? [];
}
