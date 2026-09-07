import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronRightIcon,
  PackageIcon,
  ShieldCheckIcon,
  StarIcon,
  StoreIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { AddToCart } from "@/features/cart/components/add-to-cart";
import { ProductCard } from "@/features/products/components/product-card";
import { ProductGallery } from "@/features/products/components/product-gallery";
import { ProductImage } from "@/features/products/components/product-image";
import {
  formatCount,
  formatDate,
  formatPrice,
  stockLabel,
  stockState,
} from "@/features/products/lib/format";
import {
  DEFAULT_PRODUCT_FILTERS,
  productsHref,
} from "@/features/products/lib/product-filters";
import {
  getProduct,
  listProducts,
} from "@/features/products/server/products";
import type { Product } from "@/features/products/types";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) return { title: "Product not found" };

  return {
    title: product.name,
    // The listing's own copy, trimmed to a length a search result shows.
    description: product.description.slice(0, 160),
    openGraph: {
      title: product.name,
      description: product.description.slice(0, 160),
      images: product.images.slice(0, 1),
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[id]">) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) notFound();

  const stock = stockState(product.stock);
  const category = product.categoryId;
  const vendor = product.vendor;

  const related = category
    ? await listRelated(category._id, product._id)
    : [];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <Breadcrumb product={product} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
        <div className="lg:sticky lg:top-20 lg:h-fit">
          <ProductGallery images={product.images} name={product.name} />
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {product.isFeatured ? <Badge>Featured</Badge> : null}
              {product.brand ? (
                <span className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
                  {product.brand}
                </span>
              ) : null}
            </div>

            <h1 className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
              {product.name}
            </h1>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {/* The server keeps a rating *count* on a product but no
                  average, so this reports how many people rated it rather
                  than inventing a score out of five. */}
              {product.ratingCount > 0 ? (
                <span className="flex items-center gap-1">
                  <StarIcon className="size-4 fill-current" aria-hidden />
                  {formatCount(product.ratingCount)} ratings
                </span>
              ) : (
                <span>No ratings yet</span>
              )}
              <span aria-hidden>·</span>
              <span>Listed {formatDate(product.createdAt)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <p className="font-heading text-3xl font-semibold tracking-tight">
              {formatPrice(product.price)}
            </p>
            <Badge
              variant={stock === "out" ? "destructive" : "secondary"}
              className={cn(
                "mb-1",
                stock === "in" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
              )}
            >
              {stockLabel(product.stock)}
            </Badge>
          </div>

          {/* The buy controls sit directly under the price, above the
              description: a shopper who has decided should not have to scroll
              past the copy to act. */}
          <AddToCart productId={product._id} stock={product.stock} />

          <Separator />

          <section className="flex flex-col gap-2">
            <h2 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
              About this item
            </h2>
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {product.description}
            </p>
          </section>

          {product.tags.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
                Tags
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    render={
                      <Link
                        href={productsHref({
                          ...DEFAULT_PRODUCT_FILTERS,
                          tags: [tag],
                        })}
                      />
                    }
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </section>
          ) : null}

          {vendor ? <VendorPanel vendor={vendor} /> : null}

          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-muted/40 p-4 text-sm">
            <Detail label="Category">
              {category ? (
                <Link
                  href={productsHref({
                    ...DEFAULT_PRODUCT_FILTERS,
                    categoryId: category._id,
                  })}
                  className="underline-offset-2 hover:underline"
                >
                  {category.name}
                </Link>
              ) : (
                "Uncategorised"
              )}
            </Detail>
            <Detail label="Units available">{product.stock}</Detail>
            <Detail label="Brand">{product.brand || "Unbranded"}</Detail>
            <Detail label="Last updated">
              {formatDate(product.updatedAt)}
            </Detail>
          </dl>

          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4" aria-hidden />
            Sold and fulfilled by the shop listed above.
          </p>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-14 flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              More in {category?.name}
            </h2>
            {category ? (
              <Button
                render={
                  <Link
                    href={productsHref({
                      ...DEFAULT_PRODUCT_FILTERS,
                      categoryId: category._id,
                    })}
                  />
                }
                variant="ghost"
                size="sm"
              >
                See all
                <ChevronRightIcon data-icon="inline-end" />
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard key={item._id} product={item} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Four more listings from the same category.
 *
 * Asks for one extra row so removing the product being viewed still leaves
 * a full set.
 */
async function listRelated(categoryId: string, excludeId: string) {
  const { page } = await listProducts({
    ...DEFAULT_PRODUCT_FILTERS,
    categoryId,
    limit: 5,
  });

  return page.docs.filter((item) => item._id !== excludeId).slice(0, 4);
}

function Breadcrumb({ product }: { product: Product }) {
  const category = product.categoryId;

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        <li>
          <Link href="/products" className="hover:text-foreground">
            All products
          </Link>
        </li>
        {category ? (
          <>
            <ChevronRightIcon className="size-3" aria-hidden />
            <li>
              <Link
                href={productsHref({
                  ...DEFAULT_PRODUCT_FILTERS,
                  categoryId: category._id,
                })}
                className="hover:text-foreground"
              >
                {category.name}
              </Link>
            </li>
          </>
        ) : null}
        <ChevronRightIcon className="size-3" aria-hidden />
        <li aria-current="page" className="max-w-60 truncate text-foreground">
          {product.name}
        </li>
      </ol>
    </nav>
  );
}

function VendorPanel({
  vendor,
}: {
  vendor: NonNullable<Product["vendor"]>;
}) {
  return (
    <section className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-foreground/10">
      <div className="relative size-11 shrink-0 overflow-hidden rounded-full bg-muted">
        {vendor.logoUrl ? (
          <ProductImage
            src={vendor.logoUrl}
            alt={vendor.name}
            sizes="44px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <StoreIcon className="size-5" aria-hidden />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{vendor.name}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          {vendor.ratingCount > 0 ? (
            <>
              <StarIcon className="size-3 fill-current" aria-hidden />
              {vendor.ratingAverage.toFixed(1)} ·{" "}
              {formatCount(vendor.ratingCount)} ratings
            </>
          ) : (
            <>
              <PackageIcon className="size-3" aria-hidden />
              New shop
            </>
          )}
        </p>
      </div>

      <Button
        render={
          <Link
            href={productsHref({
              ...DEFAULT_PRODUCT_FILTERS,
              vendor: vendor._id,
            })}
          />
        }
        variant="outline"
        size="sm"
      >
        Shop listings
      </Button>
    </section>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
