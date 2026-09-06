import { PackageSearchIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ProductListItem } from "../types";
import { ProductCard, ProductCardSkeleton } from "./product-card";

/** How many cards get `preload` — roughly the first row on a wide screen. */
const ABOVE_THE_FOLD = 4;

export function ProductGrid({ products }: { products: ProductListItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <ProductCard
          key={product._id}
          product={product}
          preload={index < ABOVE_THE_FOLD}
        />
      ))}
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * Shown when a query matches nothing. It offers the way out (drop the
 * filters) rather than only reporting the dead end.
 */
export function ProductGridEmpty({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <PackageSearchIcon className="size-8 text-muted-foreground" aria-hidden />
      <h2 className="font-heading text-base font-medium">
        {filtered ? "Nothing matches those filters" : "No products yet"}
      </h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        {filtered
          ? "Try a broader price range, fewer tags, or a different category."
          : "The catalogue is empty right now. Check back once shops start listing."}
      </p>
      {filtered ? (
        <Button render={<Link href="/products" />} variant="outline" size="lg">
          Clear all filters
        </Button>
      ) : null}
    </div>
  );
}
