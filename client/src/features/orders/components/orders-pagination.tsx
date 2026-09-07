import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ordersHref } from "../lib/order-filters";
import type { OrderFilters, OrderPage } from "../types";

/**
 * Prev / next for the order history.
 *
 * Simpler than the catalogue's numbered pager on purpose: an order history is
 * read newest-first and walked, not jumped around. The orders endpoint also
 * reports only a page count — there is no `hasNextPage` to lean on, so the
 * bounds are worked out here.
 */
export function OrdersPagination({
  page,
  filters,
}: {
  page: OrderPage;
  filters: OrderFilters;
}) {
  const { page: current, pages } = page.pagination;
  if (pages <= 1) return null;

  return (
    <nav
      aria-label="Order history pages"
      className="flex items-center justify-center gap-3 pt-2"
    >
      <Step
        href={ordersHref({ ...filters, page: current - 1 })}
        disabled={current <= 1}
        label="Previous page"
      >
        <ChevronLeftIcon className="size-4" aria-hidden />
      </Step>

      <span className="text-xs text-muted-foreground">
        Page {current} of {pages}
      </span>

      <Step
        href={ordersHref({ ...filters, page: current + 1 })}
        disabled={current >= pages}
        label="Next page"
      >
        <ChevronRightIcon className="size-4" aria-hidden />
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
  href: ReturnType<typeof ordersHref>;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

  if (disabled) {
    return (
      <span aria-disabled className={cn(className, "opacity-40")}>
        {children}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(className, "hover:bg-muted hover:text-foreground")}
    >
      {children}
      <span className="sr-only">{label}</span>
    </Link>
  );
}
