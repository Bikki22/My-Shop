import type { Metadata } from "next";
import { Suspense } from "react";
import { HydrationBoundary } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { prefetchCategories } from "@/features/categories/server/prefetch";
import { ActiveFilters } from "@/features/products/components/active-filters";
import {
  CatalogueCount,
  CatalogueGrid,
} from "@/features/products/components/catalogue-grid";
import { ProductSearch } from "@/features/products/components/product-search";
import { ProductsAside } from "@/features/products/components/products-aside";
import { parseProductFilters } from "@/features/products/lib/product-filters";
import { prefetchProducts } from "@/features/products/server/prefetch";
import { createServerQueryClient, dehydrateQueries } from "@/lib/query/server";

export const metadata: Metadata = {
  title: "All products",
  description: "Browse every listing on the marketplace.",
};

/**
 * The catalogue.
 *
 * It sits in a `(catalogue)` route group so its `loading.tsx` covers this page
 * alone. At `products/loading.tsx` it would also wrap `[id]`, and that Suspense
 * boundary flushes the shell — and with it a 200 — before a missing product can
 * reach `notFound()`.
 *
 * Everything the visitor chose — the search term, the sidebar's filters, the
 * sort, the page — lives in the URL and is fetched on the server, so a result
 * set is always shareable, reload-safe and crawlable. That has not changed.
 *
 * What TanStack Query adds is what happens *between* those renders. The page is
 * prefetched here and handed to the client cache, and the grid reads it from
 * there — so paging or refining keeps the current results on screen while the
 * next set loads instead of tearing down to a skeleton, and a filter
 * combination already visited comes straight back from memory. The category
 * list is fetched once and shared by the rail, the sheet and the chips rather
 * than prop-drilled from a fetch that repeated on every render.
 *
 * Both reads are awaited at the top rather than streamed under a `<Suspense>`
 * boundary, because everything on this page is downstream of them and the
 * result count belongs in the same cache entry as the grid — splitting them
 * would have the header fetch the list a second time. `loading.tsx` mirrors this
 * layout for a hard navigation, and a soft one keeps the previous page on screen
 * through the transition, so there is nothing a streamed shell would add.
 */
export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const filters = parseProductFilters(await searchParams);
  const queryClient = createServerQueryClient();

  // Independent reads — the grid should not wait on the category list.
  await Promise.all([
    prefetchProducts(queryClient, filters),
    prefetchCategories(queryClient),
  ]);

  return (
    <HydrationBoundary state={dehydrateQueries(queryClient)}>
      <div className="mx-auto w-full max-w-6xl px-4 py-10">
        <header className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              All products
            </h1>
            <p className="text-sm text-muted-foreground">
              {/* Reads the same cache entry as the grid, so the count and the
                  results can never describe different pages. Suspense because
                  it reads the filters from `useSearchParams()`. */}
              <Suspense fallback="Loading the catalogue…">
                <CatalogueCount />
              </Suspense>
            </p>
          </div>

          <Suspense fallback={<Skeleton className="h-11 w-full rounded-full" />}>
            <ProductSearch />
          </Suspense>
        </header>

        <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:gap-8">
          <Suspense
            fallback={
              <Skeleton className="h-14 rounded-2xl lg:h-40 lg:w-44 lg:shrink-0" />
            }
          >
            <ProductsAside />
          </Suspense>

          <main className="flex min-w-0 flex-1 flex-col gap-5">
            <Suspense fallback={null}>
              <ActiveFilters />
            </Suspense>

            <Suspense fallback={null}>
              <CatalogueGrid />
            </Suspense>
          </main>
        </div>
      </div>
    </HydrationBoundary>
  );
}
