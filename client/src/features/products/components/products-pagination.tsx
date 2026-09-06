import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Paginated } from "@/lib/api";
import { cn } from "@/lib/utils";
import { productsHref } from "../lib/product-filters";
import type { ProductFilters, ProductListItem } from "../types";

/**
 * Page links for the catalogue.
 *
 * Real `<a>`s, not buttons: a page of results is a URL, so it should be
 * openable in a new tab, prefetchable, and crawlable.
 */
export function ProductsPagination({
  page,
  filters,
}: {
  page: Paginated<ProductListItem>;
  filters: ProductFilters;
}) {
  if (page.totalPages <= 1) return null;

  const href = (target: number) => productsHref({ ...filters, page: target });

  return (
    <nav
      aria-label="Catalogue pages"
      className="flex items-center justify-center gap-1 pt-2"
    >
      <Step
        href={href(page.page - 1)}
        disabled={!page.hasPrevPage}
        label="Previous page"
      >
        <ChevronLeftIcon className="size-4" />
      </Step>

      {pageWindow(page.page, page.totalPages).map((entry, index) =>
        entry === "gap" ? (
          <span
            key={`gap-${String(index)}`}
            aria-hidden
            className="px-1 text-sm text-muted-foreground"
          >
            …
          </span>
        ) : (
          <Link
            key={entry}
            href={href(entry)}
            aria-current={entry === page.page ? "page" : undefined}
            className={cn(
              "inline-flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              entry === page.page
                ? "bg-primary font-medium text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {entry}
          </Link>
        ),
      )}

      <Step
        href={href(page.page + 1)}
        disabled={!page.hasNextPage}
        label="Next page"
      >
        <ChevronRightIcon className="size-4" />
      </Step>
    </nav>
  );
}

function Step({
  href,
  disabled,
  label,
  children,
}: {
  href: ReturnType<typeof productsHref>;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "opacity-40")}>
        {children}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Link href={href} className={cn(className, "hover:bg-muted hover:text-foreground")}>
      {children}
      <span className="sr-only">{label}</span>
    </Link>
  );
}

/**
 * First, last, and the neighbours of the current page, with gaps between.
 * Keeps the control a fixed width however deep the catalogue gets.
 */
function pageWindow(current: number, total: number): (number | "gap")[] {
  const pages = new Set<number>([1, total, current]);
  if (current - 1 > 1) pages.add(current - 1);
  if (current + 1 < total) pages.add(current + 1);

  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  return sorted.flatMap((page, index) =>
    index > 0 && page - sorted[index - 1] > 1
      ? (["gap", page] as (number | "gap")[])
      : [page],
  );
}
