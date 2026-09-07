import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { SellerProductTable } from "@/features/products/components/seller-product-table";
import { listMyProducts } from "@/features/products/server/seller-products";
import { NoShopPanel } from "@/features/vendors/components/no-shop-panel";
import { getMyVendor } from "@/features/vendors/server/vendors";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = {
  title: "Products",
  description: "The listings your shop has on the marketplace.",
};

const PAGE_SIZE = 20;

/**
 * The merchant's listings.
 *
 * A Server Component, like the order history and for the same reasons: the
 * search term and the page live in the URL, so the view is shareable and
 * reload-safe, and there is no client state on the page at all. Writes are
 * the exception — those are Client Components that refresh this route.
 */
export default async function SellerProductsPage({
  searchParams,
}: PageProps<"/seller/products">) {
  const params = await searchParams;
  const shop = await getMyVendor();

  if (!shop) {
    return <NoShopPanel />;
  }

  const rawSearch = params["q"];
  const search = (Array.isArray(rawSearch) ? rawSearch[0] : rawSearch) ?? "";
  const rawPage = params["page"];
  const page = Number(Array.isArray(rawPage) ? rawPage[0] : rawPage) || 1;

  const { page: result, error } = await listMyProducts(shop._id, {
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  });

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Products
          </h1>
          <p className="text-sm text-muted-foreground">
            {error
              ? "Your listings are unavailable right now."
              : result.totalDocs === 0
                ? search
                  ? "Nothing matches that search."
                  : "You have not listed anything yet."
                : `${pluralize(result.totalDocs, "listing")} in ${shop.name}.`}
          </p>
        </div>

        <Button render={<Link href={routes.seller.newProduct} />}>
          <PlusIcon />
          New listing
        </Button>
      </header>

      {/* A plain GET form, so searching is a navigation: the result has its
          own URL and the back button undoes it. */}
      <form action={routes.seller.products} className="flex max-w-sm gap-2">
        <Input
          name="q"
          type="search"
          defaultValue={search}
          placeholder="Search your listings"
          aria-label="Search your listings"
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>Could not load your listings</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : result.docs.length === 0 ? (
        <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
          {search
            ? "No listings match that search."
            : "Your first listing is the one that starts the shop."}
        </p>
      ) : (
        <>
          <SellerProductTable products={result.docs} />

          {result.totalPages > 1 ? (
            <nav
              aria-label="Pages"
              className="flex items-center justify-between gap-4 text-sm"
            >
              <span className="text-muted-foreground">
                Page {result.page} of {result.totalPages}
              </span>
              <div className="flex gap-2">
                {result.hasPrevPage ? (
                  <Button
                    render={
                      <Link
                        href={`${routes.seller.products}?page=${String(result.prevPage ?? 1)}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                      />
                    }
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                ) : null}
                {result.hasNextPage ? (
                  <Button
                    render={
                      <Link
                        href={`${routes.seller.products}?page=${String(result.nextPage ?? 1)}${search ? `&q=${encodeURIComponent(search)}` : ""}`}
                      />
                    }
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                ) : null}
              </div>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
