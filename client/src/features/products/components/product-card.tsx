import Link from "next/link";
import { ArrowUpRightIcon, SparklesIcon, StarIcon } from "lucide-react";
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

export function ProductCard({ product, preload = false }: ProductCardProps) {
  const stock = stockState(product.stock);
  const [cover, hoverImage] = product.images;

  return (
    <article
      className={cn(
        "group/product relative flex flex-col overflow-hidden rounded-2xl bg-card text-card-foreground",
        "ring-1 ring-foreground/10 transition-all duration-300 ease-out",
        "hover:-translate-y-1 hover:shadow-[0_18px_40px_-24px_oklch(0_0_0/0.45)] hover:ring-foreground/20",
        "focus-within:-translate-y-1 focus-within:ring-ring/60",
      )}
    >
      <div className="relative aspect-4/5 overflow-hidden bg-muted">
        <ProductImage
          src={cover}
          alt={product.name}
          sizes={CARD_IMAGE_SIZES}
          preload={preload}
          className={cn(
            "object-cover transition-transform duration-500 ease-out",
            "group-hover/product:scale-[1.06]",
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

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent opacity-0 transition-opacity duration-300 group-hover/product:opacity-100" />

        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-1.5">
            {product.isFeatured ? (
              <Badge className="shadow-sm">
                <SparklesIcon data-icon="inline-start" aria-hidden />
                Featured
              </Badge>
            ) : null}
            {stock === "low" ? (
              <Badge
                variant="destructive"
                className="bg-destructive/15 shadow-sm backdrop-blur-sm"
              >
                Only {product.stock} left
              </Badge>
            ) : null}
          </div>
        </div>

        {stock === "out" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-background/85 px-3 py-1 text-xs font-medium tracking-wide uppercase shadow-sm backdrop-blur-sm">
              Sold out
            </span>
          </div>
        ) : null}

        {/* Decorative: the card's real link is the stretched title below. */}
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-2",
            "rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur",
            "translate-y-3 opacity-0 transition-all duration-300 ease-out",
            "group-hover/product:translate-y-0 group-hover/product:opacity-100",
            "group-focus-within/product:translate-y-0 group-focus-within/product:opacity-100",
          )}
        >
          View details
          <ArrowUpRightIcon className="size-3.5" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {product.brand ? (
          <p className="text-[0.6875rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
            {product.brand}
          </p>
        ) : null}

        <h3 className="font-heading text-sm leading-snug font-medium">
          {/* `after:` stretches this link over the whole card, so the card is
              one large target while the accessible name stays the product. */}
          <Link
            href={`/products/${product._id}`}
            className="line-clamp-2 outline-none after:absolute after:inset-0 after:rounded-2xl group-hover/product:underline group-hover/product:decoration-1 group-hover/product:underline-offset-2"
          >
            {product.name}
          </Link>
        </h3>

        {product.tags.length > 0 ? (
          <div className="mt-0.5 flex flex-wrap gap-1">
            {product.tags.slice(0, 2).map((tag) => (
              <Badge
                key={tag}
                variant="ghost"
                className="bg-muted px-1.5 text-[0.6875rem] text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="font-heading text-base font-semibold tracking-tight">
            {formatPrice(product.price)}
          </p>

          {/* The server stores a rating *count* but no average yet, so this
              reports participation rather than inventing a score. */}
          {product.ratingCount > 0 ? (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <StarIcon className="size-3.5 fill-current" aria-hidden />
              {formatCount(product.ratingCount)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">New</span>
          )}
        </div>
      </div>
    </article>
  );
}

/** Same silhouette as the card, for `loading.tsx` and Suspense fallbacks. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <div className="aspect-4/5 animate-pulse bg-muted" />
      <div className="flex flex-col gap-2 p-4">
        <div className="h-2.5 w-16 animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
        <div className="h-3.5 w-2/3 animate-pulse rounded bg-muted" />
        <div className="mt-3 h-4 w-24 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
