"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";
import {
  DEFAULT_PRODUCT_FILTERS,
  parseProductFilters,
  productsHref,
  withFilters,
} from "../lib/product-filters";
import type { ProductFilters } from "../types";

/**
 * The catalogue's filter state, which lives in the URL rather than in
 * React.
 *
 * That is what makes a filtered view shareable, survive a reload, and
 * re-render on the server — the page reads the same query params these
 * writes produce, so results are always server-rendered from the address
 * bar. `isPending` is the transition covering that round trip; the toolbar
 * uses it to show the grid is catching up instead of freezing.
 */
export function useProductFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const filters = useMemo(
    () => parseProductFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const navigate = useCallback(
    (next: ProductFilters) => {
      startTransition(() => {
        // `replace`, not `push`: refining a search should not bury the page
        // the visitor arrived from under a dozen history entries.
        router.replace(productsHref(next), { scroll: false });
      });
    },
    [router],
  );

  /** Applies a partial change, returning to page one. */
  const apply = useCallback(
    (changes: Partial<ProductFilters>) => {
      navigate(withFilters(filters, changes));
    },
    [filters, navigate],
  );

  /** Applies a whole new filter set — what the sidebar's Apply submits. */
  const replaceAll = useCallback(
    (next: ProductFilters) => {
      navigate({ ...next, page: 1 });
    },
    [navigate],
  );

  const reset = useCallback(() => {
    navigate(DEFAULT_PRODUCT_FILTERS);
  }, [navigate]);

  return { filters, apply, replaceAll, reset, isPending };
}
