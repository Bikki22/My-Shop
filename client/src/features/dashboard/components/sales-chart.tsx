"use client";

import { useId, useState } from "react";
import { formatCompactPrice, formatPrice, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnalyticsInterval, SeriesPoint } from "../types";

/**
 * Sales over time, as columns.
 *
 * **One series, one axis.** The buckets carry several money figures (GMV,
 * commission, vendor earnings) and it is tempting to draw two of them
 * together, but commission runs at about a tenth of GMV — as a second series
 * it would be an invisible sliver, and giving it its own scale would be a
 * dual-axis chart, which misleads by construction. The other figures are stat
 * cards above the chart instead, where they are read as magnitudes rather
 * than compared as shapes.
 *
 * Columns rather than a line because the buckets are discrete totals — a day
 * with no sales is a real zero, and a line would interpolate straight through
 * it and imply trade that did not happen. The server gap-fills the series, so
 * the quiet days are present and render as empty slots.
 *
 * Plain elements rather than SVG: the columns need to be hover *and* keyboard
 * targets, and a `<button>` gets focus, `:focus-visible` and touch handling
 * for free. It also means the layout is flexbox, so the chart is responsive
 * without a viewBox that would stretch the type.
 *
 * Colour: the design system is intentionally monochrome (every `--chart-*`
 * token is chroma 0), and with a single series there is no identity to encode
 * — so the mark is `--primary`, which flips with the theme, and every piece
 * of text wears a text token rather than the data colour.
 */
export function SalesChart({
  points,
  interval,
  /** Which money field to plot. The two dashboards lead with different ones. */
  field = "gmv",
  label,
  className,
  dimmed = false,
}: {
  points: SeriesPoint[];
  interval: AnalyticsInterval;
  field?: "gmv" | "vendorEarnings" | "commission";
  label: string;
  className?: string;
  dimmed?: boolean;
}) {
  const tableId = useId();
  const [active, setActive] = useState<number | null>(null);

  const values = points.map((point) => point[field]);
  const max = Math.max(...values, 0);
  const scale = niceCeiling(max);

  // A range with no sales at all would otherwise render four gridlines
  // labelled 0 and a row of nothing, which looks broken rather than empty.
  const isEmpty = max === 0;

  return (
    <figure
      className={cn(
        "flex flex-col gap-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-opacity",
        dimmed && "opacity-60",
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        {/* The caption names the series, which is why there is no legend box:
            with one colour a legend would only restate this line. */}
        <span className="font-heading text-base font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          {pluralize(points.length, interval === "day" ? "day" : "month")}
        </span>
      </figcaption>

      {isEmpty ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No sales in this period.
        </p>
      ) : (
        <div className="flex gap-3">
          {/* Y axis. Tabular figures here because these *are* a column that
              has to align vertically. */}
          <div
            aria-hidden
            className="flex h-48 w-14 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-muted-foreground"
          >
            {[scale, scale * 0.75, scale * 0.5, scale * 0.25, 0].map((tick) => (
              <span key={tick}>{formatCompactPrice(tick)}</span>
            ))}
          </div>

          <div className="relative min-w-0 flex-1">
            {/* Gridlines: hairline, solid, one step off the surface, and
                behind the data. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex flex-col justify-between"
            >
              {[0, 1, 2, 3, 4].map((line) => (
                <div key={line} className="h-px w-full bg-border" />
              ))}
            </div>

            {/* `gap-0.5` is the 2px surface gap that separates touching
                columns — the separation is negative space, not a stroke. */}
            <div className="relative flex h-48 items-end gap-0.5">
              {points.map((point, index) => {
                const value = point[field];
                const height = scale === 0 ? 0 : (value / scale) * 100;

                return (
                  <button
                    key={point.date}
                    type="button"
                    // The bar is the visual, but the *button* spans the full
                    // height so the hit target is the whole column — a 3px
                    // bar on a quiet day is otherwise impossible to hover.
                    className="group relative flex h-full flex-1 items-end outline-none"
                    onMouseEnter={() => {
                      setActive(index);
                    }}
                    onMouseLeave={() => {
                      setActive(null);
                    }}
                    onFocus={() => {
                      setActive(index);
                    }}
                    onBlur={() => {
                      setActive(null);
                    }}
                    aria-describedby={tableId}
                  >
                    <span
                      className={cn(
                        // 4px rounded data-end, square at the baseline, and
                        // capped so a wide chart keeps air between columns
                        // rather than fusing into a block.
                        "w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity",
                        "group-hover:opacity-80 group-focus-visible:opacity-80",
                        // A zero still gets a sliver, so the slot reads as
                        // "nothing sold" rather than as a rendering gap.
                        value === 0 && "opacity-25",
                      )}
                      style={{ height: `${String(Math.max(height, 1.5))}%` }}
                    />

                    {active === index ? (
                      <span
                        role="presentation"
                        className={cn(
                          "pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2",
                          "rounded-lg bg-popover px-2.5 py-1.5 text-left whitespace-nowrap shadow-md ring-1 ring-foreground/10",
                          // Nudged in at the edges so the first and last
                          // tooltips are not clipped by the plot area.
                          index === 0 && "left-0 translate-x-0",
                          index === points.length - 1 &&
                            "left-auto right-0 translate-x-0",
                        )}
                      >
                        <span className="block text-[10px] text-muted-foreground">
                          {formatBucket(point.date, interval)}
                        </span>
                        <span className="block text-xs font-semibold tabular-nums">
                          {formatPrice(value)}
                        </span>
                        <span className="block text-[10px] text-muted-foreground">
                          {pluralize(point.orders, "order")}
                        </span>
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            {/* X axis. Only the ends are labelled: a tick under all 30 columns
                is unreadable, and the tooltip carries the rest. */}
            <div
              aria-hidden
              className="mt-2 flex justify-between text-[10px] text-muted-foreground"
            >
              <span>{formatBucket(points[0]?.date ?? "", interval)}</span>
              <span>
                {formatBucket(points.at(-1)?.date ?? "", interval)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* The table view. Every value the chart encodes visually is also here
          as text, so the figures are never gated behind hover — which is what
          a screen reader, a keyboard and a printout all need. */}
      <details className="text-sm">
        <summary className="w-fit cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
          View as table
        </summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table id={tableId} className="w-full text-left text-xs">
            <caption className="sr-only">{label}, by period</caption>
            <thead className="sticky top-0 bg-card">
              <tr className="border-b">
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Period
                </th>
                <th scope="col" className="py-1.5 pr-3 font-medium">
                  Amount
                </th>
                <th scope="col" className="py-1.5 font-medium">
                  Orders
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {points.map((point) => (
                <tr key={point.date} className="border-b last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-normal">
                    {formatBucket(point.date, interval)}
                  </th>
                  <td className="py-1.5 pr-3">{formatPrice(point[field])}</td>
                  <td className="py-1.5">{point.orders}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/**
 * Rounds an axis maximum up to something a person would choose — 1, 2 or 5
 * times a power of ten — so the ticks land on clean numbers instead of
 * `Rs. 18,505.5`.
 */
function niceCeiling(max: number): number {
  if (max <= 0) return 0;

  const magnitude = 10 ** Math.floor(Math.log10(max));
  const normalised = max / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

  return step * magnitude;
}

/**
 * `2026-09-07` → `7 Sep`, `2026-09` → `Sep 2026`.
 *
 * Parsed as UTC and formatted in UTC. The bucket key is a calendar label the
 * server already resolved in the analytics timezone, not an instant — letting
 * the browser re-interpret it in its own zone would shift every label by a
 * day for anyone outside Nepal.
 */
function formatBucket(date: string, interval: AnalyticsInterval): string {
  if (!date) return "";

  if (interval === "month") {
    return new Date(`${date}-01T00:00:00Z`).toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }

  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
