import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/features/products/components/product-grid";

/** Mirrors the catalogue's layout so the page does not jump when it lands. */
export default function ProductsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-11 w-full rounded-full" />
      </div>

      <div className="mt-6 flex flex-col gap-5 lg:flex-row lg:gap-8">
        <Skeleton className="h-14 rounded-2xl lg:h-40 lg:w-44 lg:shrink-0" />
        <div className="min-w-0 flex-1">
          <ProductGridSkeleton />
        </div>
      </div>
    </div>
  );
}
