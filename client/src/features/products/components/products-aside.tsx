"use client";

import {
  ArrowDownUpIcon,
  RotateCcwIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useState } from "react";
import type { Category } from "@/features/categories/types";
import { cn } from "@/lib/utils";
import { useProductFilters } from "../hooks/use-product-filters";
import { countActiveFilters } from "../lib/product-filters";
import { PRODUCT_SORT_LABELS } from "../types";
import { ProductFiltersSheet } from "./product-filters-sheet";

/**
 * The catalogue rail: a permanent strip beside the grid whose Filters
 * button opens the filter sidebar.
 *
 * The rail stays put so the controls are always one click away, while the
 * filters themselves live in a sheet — a full sidebar pinned open would
 * cost the grid a column at every width, and a separate filters *page*
 * would make refining a search a round trip away from the results.
 */
export function ProductsAside({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const { filters, replaceAll, reset, isPending } = useProductFilters();
  const activeCount = countActiveFilters(filters);

  return (
    <aside
      aria-label="Catalogue controls"
      className="lg:sticky lg:top-20 lg:h-fit lg:w-44 lg:shrink-0"
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl bg-card p-2 ring-1 ring-foreground/10",
          "lg:flex-col lg:items-stretch lg:gap-1 lg:p-3",
        )}
      >
        <RailButton
          onClick={() => {
            setOpen(true);
          }}
          icon={<SlidersHorizontalIcon className="size-4" />}
          label="Filters"
          badge={activeCount > 0 ? activeCount : undefined}
          emphasised
        />

        <RailButton
          onClick={() => {
            setOpen(true);
          }}
          icon={<ArrowDownUpIcon className="size-4" />}
          label="Sort"
          hint={PRODUCT_SORT_LABELS[filters.sort]}
        />

        {activeCount > 0 ? (
          <RailButton
            onClick={reset}
            icon={<RotateCcwIcon className="size-4" />}
            label="Clear"
            disabled={isPending}
          />
        ) : null}
      </div>

      <ProductFiltersSheet
        open={open}
        onOpenChange={setOpen}
        filters={filters}
        categories={categories}
        onApply={replaceAll}
      />
    </aside>
  );
}

function RailButton({
  icon,
  label,
  hint,
  badge,
  emphasised = false,
  disabled = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  badge?: number;
  emphasised?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group/rail flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors outline-none",
        "focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        emphasised
          ? "bg-primary text-primary-foreground hover:bg-primary/85"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>

      {badge !== undefined ? (
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-semibold",
            emphasised
              ? "bg-primary-foreground/20 text-primary-foreground"
              : "bg-primary text-primary-foreground",
          )}
        >
          {badge}
          <span className="sr-only"> filters applied</span>
        </span>
      ) : null}

      {hint ? (
        <span className="hidden max-w-24 truncate text-xs font-normal text-muted-foreground lg:inline">
          {hint}
        </span>
      ) : null}
    </button>
  );
}
