"use client";

import { XIcon } from "lucide-react";
import type { Category } from "@/features/categories/types";
import { cn } from "@/lib/utils";
import { formatPrice } from "../lib/format";
import { countActiveFilters } from "../lib/product-filters";
import { useProductFilters } from "../hooks/use-product-filters";
import type { ProductFilters } from "../types";

/**
 * What is currently narrowing the catalogue, each removable on its own.
 *
 * The sidebar is where filters are *set*; this row is where they are seen
 * and undone, so a visitor never has to reopen a panel to find out why a
 * grid looks empty.
 */
export function ActiveFilters({ categories }: { categories: Category[] }) {
  const { filters, apply, reset, isPending } = useProductFilters();

  if (countActiveFilters(filters) === 0) return null;

  const categoryName = filters.categoryId
    ? (categories.find((category) => category._id === filters.categoryId)
        ?.name ?? "Category")
    : null;

  const chips: { key: string; label: string; clear: Partial<ProductFilters> }[] =
    [];

  if (filters.search) {
    chips.push({
      key: "search",
      label: `“${filters.search}”`,
      clear: { search: "" },
    });
  }
  if (categoryName) {
    chips.push({
      key: "category",
      label: categoryName,
      clear: { categoryId: null },
    });
  }
  if (filters.vendor) {
    chips.push({ key: "vendor", label: "One shop", clear: { vendor: null } });
  }
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    chips.push({
      key: "price",
      label: priceLabel(filters.minPrice, filters.maxPrice),
      clear: { minPrice: null, maxPrice: null },
    });
  }
  for (const tag of filters.tags) {
    chips.push({
      key: `tag:${tag}`,
      label: `#${tag}`,
      clear: { tags: filters.tags.filter((other) => other !== tag) },
    });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 transition-opacity",
        isPending && "opacity-60",
      )}
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => {
            apply(chip.clear);
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-1.5 pl-3 text-xs font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {chip.label}
          <XIcon className="size-3.5 text-muted-foreground" aria-hidden />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}

      <button
        type="button"
        onClick={reset}
        className="rounded-full px-2 py-1 text-xs text-muted-foreground underline-offset-2 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        Clear all
      </button>
    </div>
  );
}

function priceLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null)
    return `${formatPrice(min)} – ${formatPrice(max)}`;
  if (min !== null) return `From ${formatPrice(min)}`;
  return `Up to ${formatPrice(max ?? 0)}`;
}
