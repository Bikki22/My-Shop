"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { isApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useProductsQuery } from "../hooks/use-products-query";
import { useProductFilters } from "../hooks/use-product-filters";
import { hasActiveFilters } from "../lib/product-filters";
import { ProductGrid, ProductGridEmpty, ProductGridSkeleton } from "./product-grid";
import { ProductsPagination } from "./products-pagination";

/**
 * The catalogue's results: the grid, its empty state, and the pager.
 *
 * Reads the filters from the URL and the page from the shared cache, so it
 * agrees with what the server rendered and with what every other component
 * thinks the filters are. One component owns the loading / empty / error
 * decision rather than three each guessing what to show when there is no page.
 *
 * `isPlaceholderData` is what makes paging feel instant: the previous grid stays
 * up, dimmed, while the next one loads. A skeleton only appears when there is
 * genuinely nothing to show yet — a first visit that the server prefetch missed.
 */
export function CatalogueGrid() {
  const { filters, isPending: isNavigating } = useProductFilters();
  const { data: page, error, isPending, isPlaceholderData } =
    useProductsQuery(filters);

  if (isPending) {
    return <ProductGridSkeleton />;
  }

  if (error || !page) {
    return (
      <Alert variant="destructive">
        <TriangleAlertIcon />
        <AlertTitle>Could not load products</AlertTitle>
        <AlertDescription>
          {isApiError(error)
            ? error.message
            : "The catalogue is unavailable right now."}
        </AlertDescription>
      </Alert>
    );
  }

  if (page.docs.length === 0) {
    return <ProductGridEmpty filtered={hasActiveFilters(filters)} />;
  }

  // `isNavigating` covers the URL transition, `isPlaceholderData` the fetch —
  // either means what is on screen is the old answer.
  const stale = isPlaceholderData || isNavigating;

  return (
    <div
      aria-busy={stale || undefined}
      className={cn(
        "flex flex-col gap-5 transition-opacity",
        stale && "opacity-60",
      )}
    >
      <ProductGrid products={page.docs} />
      <ProductsPagination page={page} filters={filters} />
    </div>
  );
}

/**
 * The result count, which the header renders above the grid.
 *
 * Split out so the count reads from the same cache entry as the grid without
 * the page having to fetch the list itself just to say "showing 1–12 of 40".
 */
export function CatalogueCount() {
  const { filters } = useProductFilters();
  const { data: page, error, isPending } = useProductsQuery(filters);

  if (isPending) return <>Loading the catalogue…</>;
  if (error || !page) return <>The catalogue is unavailable right now.</>;
  if (page.totalDocs === 0) return <>Nothing to show yet.</>;

  const firstOnPage = (page.page - 1) * page.limit + 1;
  const lastOnPage = firstOnPage + page.docs.length - 1;

  return (
    <>
      Showing {firstOnPage}–{lastOnPage} of {page.totalDocs} listings
    </>
  );
}
