import type { Route } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import { OPEN_STATUSES, type FulfilmentCounts } from "../types";

/** Sentence-case labels — the status enum shouted at the reader otherwise. */
const STATUS_LABELS: Record<(typeof OPEN_STATUSES)[number], string> = {
  PENDING: "Awaiting confirmation",
  CONFIRMED: "Confirmed",
  PROCESSING: "Being packed",
  SHIPPED: "In transit",
};

/**
 * The open worklist: parcels that are neither delivered nor cancelled.
 *
 * Unwindowed, like the payout figures — a queue is a question about now, and
 * a parcel stuck in "being packed" for three weeks is precisely the one a
 * reporting window would hide.
 *
 * Rendered as a row of counts rather than a chart: four numbers that are read
 * individually and acted on are a list, not a distribution.
 */
export function FulfilmentStrip({
  counts,
  href,
  caption,
  className,
}: {
  counts: FulfilmentCounts;
  /** Where the counts lead — each dashboard has its own order queue. */
  href: Route;
  caption: string;
  className?: string;
}) {
  const total = OPEN_STATUSES.reduce((sum, status) => sum + counts[status], 0);

  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Open parcels
        </h2>
        <Link
          href={href}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Order queue
          <ArrowRightIcon className="size-3" />
        </Link>
      </div>

      <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing open — every parcel is delivered or cancelled.
          </p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {OPEN_STATUSES.map((status) => (
                <div key={status} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">
                    {STATUS_LABELS[status]}
                  </dt>
                  <dd className="font-heading text-xl font-semibold">
                    {formatCount(counts[status])}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{caption}</p>
          </>
        )}
      </div>
    </section>
  );
}
