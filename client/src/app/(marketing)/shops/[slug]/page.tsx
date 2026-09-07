import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isApiError, type Paginated } from "@/lib/api";
import { serverApi } from "@/lib/api/server";
import { ProductGrid } from "@/features/products/components/product-grid";
import type { ProductListItem } from "@/features/products/types";
import type { VendorSummary } from "@/features/vendors/types";
import { formatCount, pluralize } from "@/lib/format";

interface ShopPage {
  shop: VendorSummary;
  products: Paginated<ProductListItem>;
}

/**
 * Reads a shop and its listings by slug.
 *
 * `GET /vendors/slug/:slug` is scoped to shops that can actually sell, so a
 * pending, rejected or suspended shop 404s here rather than showing an empty
 * storefront — which is the right answer: an unapproved shop is not a page
 * that exists yet.
 */
async function getShopPage(slug: string): Promise<ShopPage | null> {
  try {
    const shop = await serverApi<VendorSummary>(`/vendors/slug/${slug}`);
    const products = await serverApi<Paginated<ProductListItem>>(
      `/products/shop/${slug}`,
      { unwrap: false, searchParams: { page: 1, limit: 24 } },
    );

    return { shop, products };
  } catch (caught) {
    if (
      isApiError(caught) &&
      (caught.isNotFound || caught.isForbidden || caught.status === 400)
    ) {
      return null;
    }
    throw caught;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/shops/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getShopPage(slug);

  if (!page) {
    return { title: "Shop not found" };
  }

  return {
    title: page.shop.name,
    description:
      page.shop.description ||
      `Browse everything ${page.shop.name} sells on the marketplace.`,
  };
}

/**
 * A shop's public storefront.
 *
 * The marketplace's primary facet made into a page: customers arrive here
 * from a product's shop link, and admins from the review screen to see what a
 * shop actually looks like before approving it.
 */
export default async function ShopStorefrontPage({
  params,
}: PageProps<"/shops/[slug]">) {
  const { slug } = await params;
  const page = await getShopPage(slug);

  if (!page) {
    notFound();
  }

  const { shop, products } = page;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="flex flex-col gap-3 border-b pb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {shop.name}
        </h1>
        {shop.description ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            {shop.description}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {pluralize(shop.productCount, "listing")}
          {shop.ratingCount > 0
            ? ` · rated ${shop.ratingAverage.toFixed(1)} by ${formatCount(shop.ratingCount)}`
            : null}
        </p>
      </header>

      <div className="mt-6">
        {products.docs.length === 0 ? (
          <p className="rounded-xl bg-card px-6 py-12 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
            This shop has nothing listed right now.
          </p>
        ) : (
          <ProductGrid products={products.docs} />
        )}
      </div>
    </div>
  );
}
