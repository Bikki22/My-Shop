import Link from "next/link";
import { SparklesIcon, StarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCount, formatPrice, stockState } from "../lib/format";
import type { ProductListItem } from "../types";
import { ProductImage } from "./product-image";

/**
 * Grid sizes for the catalogue's breakpoints (1 / 2 / 3 / 4 columns against
 * a 72rem container). Getting this right is most of what `next/image` needs
 * to stop shipping a 1200px file into a 300px slot.
 */
const CARD_IMAGE_SIZES =
  "(min-width: 1280px) 260px, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw";

interface ProductCardProps {
  product: ProductListItem;
  /** Preloads the photo. Pass only for the first row of the first page. */
  preload?: boolean;
}

/**
 * One listing in the catalogue.
 *
 * Follows the stall card from `design/product-listing.html`: a hairline
 * border rather than a shadow at rest, the photo on a tinted ground, and the
 * price in mono so a column of cards can be scanned down. The lift on hover
 * is the only motion — the mockup's card is a flat printed thing until you
 * reach for it.
 */
export function ProductCard({ product, preload = false }: ProductCardProps) {
  const stock = stockState(product.stock);
  const [cover, hoverImage] = product.images;

  return (
    <article
      className={cn(
        "group/product relative flex flex-col overflow-hidden rounded-xl bg-card text-card-foreground",
        "border border-border transition-all duration-300 ease-out",
        "hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_14px_30px_-16px_color-mix(in_srgb,var(--ink)_38%,transparent)]",
        "focus-within:-translate-y-0.5 focus-within:border-brand",
      )}
    >
      <div className="relative aspect-4/5 overflow-hidden bg-brand-soft">
        <ProductImage
          src={cover}
          alt={product.name}
          sizes={CARD_IMAGE_SIZES}
          preload={preload}
          className={cn(
            "object-cover transition-transform duration-500 ease-out",
            "group-hover/product:scale-[1.04]",
            stock === "out" && "opacity-60 saturate-50",
          )}
        />

        {/* A second photo, revealed on hover — the closest thing to picking
            the item up. Only rendered when the listing actually has one. */}
        {hoverImage ? (
          <div className="absolute inset-0 opacity-0 transition-opacity duration-500 group-hover/product:opacity-100">
            <ProductImage
              src={hoverImage}
              alt=""
              sizes={CARD_IMAGE_SIZES}
              className="object-cover"
            />
          </div>
        ) : null}

        <div className="absolute inset-x-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {product.isFeatured ? (
            <Badge className="gap-1 rounded-md bg-brand px-2 py-0.5 text-[0.65625rem] font-bold text-brand-foreground shadow-sm">
              <SparklesIcon data-icon="inline-start" aria-hidden />
              Featured
            </Badge>
          ) : null}
          {stock === "low" ? (
            <Badge className="rounded-md bg-danger px-2 py-0.5 text-[0.65625rem] font-bold text-white shadow-sm">
              Only {product.stock} left
            </Badge>
          ) : null}
        </div>

        {stock === "out" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-card/90 px-3 py-1 text-xs font-semibold tracking-wide uppercase shadow-sm backdrop-blur-sm">
              Sold out
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5">
        {product.brand ? (
          <p className="text-[0.6875rem] text-muted-foreground">
            {product.brand}
          </p>
        ) : null}

        <h3 className="text-[0.84375rem] leading-snug font-semibold">
          {/* `after:` stretches this link over the whole card, so the card is
              one large target while the accessible name stays the product. */}
          <Link
            href={`/products/${product._id}`}
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:rounded-xl"
          >
            {product.name}
          </Link>
        </h3>

        {product.tags.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {product.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="ghost"
                className="rounded-md bg-muted px-1.5 text-[0.6875rem] font-medium text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
          <p className="font-mono text-[0.90625rem] font-bold">
            {formatPrice(product.price)}
          </p>

          {/* The server stores a rating *count* but no average yet, so this
              reports participation rather than inventing a score. */}
          {product.ratingCount > 0 ? (
            <span className="flex items-center gap-1 text-[0.71875rem] text-muted-foreground">
              <StarIcon className="size-3.5 fill-brand text-brand" aria-hidden />
              {formatCount(product.ratingCount)}
            </span>
          ) : (
            <span className="text-[0.71875rem] font-medium text-success">
              New
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

/** Same silhouette as the card, for `loading.tsx` and Suspense fallbacks. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="aspect-4/5 animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-3.5">
        <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
