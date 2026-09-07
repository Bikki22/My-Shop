import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { rangeHref } from "../lib/analytics-filters";
import { ANALYTICS_RANGES, RANGE_LABELS, type AnalyticsRange } from "../types";

/**
 * The window picker above a dashboard.
 *
 * Real links, not buttons — the range lives in the URL, so a view stays
 * shareable, reload-safe and back-button friendly. The same contract the
 * catalogue's filters and the order history's status chips keep, and the
 * reason both dashboards render on the server as well as in the browser.
 *
 * The filter row sits in one line above the charts rather than inside a card,
 * so it reads as a control over the whole page and not as part of one figure.
 */
export function RangeTabs({
  active,
  pathname,
  className,
}: {
  active: AnalyticsRange;
  /** The page these chips are on, so one component serves both dashboards. */
  pathname: Route;
  className?: string;
}) {
  return (
    <nav
      aria-label="Reporting period"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {ANALYTICS_RANGES.map((range) => {
        const current = range === active;

        return (
          <Link
            key={range}
            href={rangeHref(pathname, range)}
            aria-current={current ? "page" : undefined}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors outline-none",
              "focus-visible:ring-3 focus-visible:ring-ring/50",
              current
                ? "border-primary bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {RANGE_LABELS[range]}
          </Link>
        );
      })}
    </nav>
  );
}
