import type { Metadata } from "next";
import { Suspense } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { listCategories } from "@/features/categories/server/categories";
import { ActiveFilters } from "@/features/products/components/active-filters";
import {
  ProductGrid,
  ProductGridEmpty,
} from "@/features/products/components/product-grid";
import { ProductSearch } from "@/features/products/components/product-search";
import { ProductsAside } from "@/features/products/components/products-aside";
import { ProductsPagination } from "@/features/products/components/products-pagination";
import {
  hasActiveFilters,
  parseProductFilters,
} from "@/features/products/lib/product-filters";
import { listProducts } from "@/features/products/server/products";

export const metadata: Metadata = {
  title: "All products",
  description: "Browse every listing on the marketplace.",
};

/**
 * The catalogue.
 *
 * It sits in a `(catalogue)` route group so its `loading.tsx` covers this
 * page alone. At `products/loading.tsx` it would also wrap `[id]`, and that
 * Suspense boundary flushes the shell — and with it a 200 — before a
 * missing product can reach `notFound()`.
 *
 * Everything the visitor chose — the search term, the sidebar's filters,
 * the sort, the page — is read from the URL and queried on the server, so
 * a result set is always shareable and reload-safe. The only client state
 * is the half-typed search box and whether the filter sheet is open.
 */
export default async function ProductsPage({
  searchParams,
}: PageProps<"/products">) {
  const filters = parseProductFilters(await searchParams);

  // Independent reads — the grid should not wait on the category list.
  const [{ page, error }, categories] = await Promise.all([
    listProducts(filters),
    listCategories(),
  ]);

  const filtered = hasActiveFilters(filters);
  const firstOnPage = (page.page - 1) * page.limit + 1;
  const lastOnPage = firstOnPage + page.docs.length - 1;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            All products
          </h1>
          <p className="text-sm text-muted-foreground">
            {error
              ? "The catalogue is unavailable right now."
              : page.totalDocs === 0
                ? "Nothing to show yet."
                : `Showing ${String(firstOnPage)}–${String(lastOnPage)} of ${String(page.totalDocs)} listings`}
          </p>
        </div>

        {/* Suspense because the search box reads `useSearchParams()`. */}
        <Suspense fallback={<Skeleton className="h-11 w-full rounded-full" />}>
          <ProductSearch />
        </Suspense>
      </header>

      <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:gap-8">
        <Suspense fallback={<Skeleton className="h-14 rounded-2xl lg:h-40 lg:w-44" />}>
          <ProductsAside categories={categories} />
        </Suspense>

        <main className="flex min-w-0 flex-1 flex-col gap-5">
          <Suspense fallback={null}>
            <ActiveFilters categories={categories} />
          </Suspense>

          {error ? (
            <Alert variant="destructive">
              <TriangleAlertIcon />
              <AlertTitle>Could not load products</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : page.docs.length === 0 ? (
            <ProductGridEmpty filtered={filtered} />
          ) : (
            <>
              <ProductGrid products={page.docs} />
              <ProductsPagination page={page} filters={filters} />
            </>
          )}
        </main>
      </div>
    </div>
  );
}
