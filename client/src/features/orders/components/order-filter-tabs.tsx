import Link from "next/link";
import { cn } from "@/lib/utils";
import { ORDER_FILTER_TABS, ordersHref } from "../lib/order-filters";
import type { OrderStatus } from "../types";

/**
 * The status chips above the history.
 *
 * Real links, not buttons: a filtered history is a URL, so it stays
 * shareable, reload-safe and back-button friendly — the same contract the
 * catalogue's filters keep.
 */
export function OrderFilterTabs({ active }: { active: OrderStatus | null }) {
  return (
    <nav aria-label="Filter orders" className="flex flex-wrap gap-2">
      {ORDER_FILTER_TABS.map((tab) => {
        const current = tab.status === active;

        return (
          <Link
            key={tab.label}
            href={ordersHref({ status: tab.status })}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              current
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
