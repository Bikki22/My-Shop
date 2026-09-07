"use client";

import Link from "next/link";
import { routes } from "@/config/routes";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactPrice, formatCount, formatPrice } from "@/lib/format";
import {
  usePlatformOverview,
  usePlatformRevenue,
} from "../hooks/use-dashboard-queries";
import type { AnalyticsRange } from "../types";
import { DashboardError } from "./dashboard-error";
import { FulfilmentStrip } from "./fulfilment-strip";
import { SalesChart } from "./sales-chart";
import { StatCard, StatGrid } from "./stat-card";

/**
 * The marketplace operator's dashboard.
 *
 * A Client Component reading the shared query cache, over a server prefetch —
 * so the first paint already has the numbers, and changing the range after
 * that is a cache read rather than a round trip. The two queries are separate
 * on purpose: the counters paint as soon as they land, without waiting for
 * the chart's heavier aggregation.
 *
 * Every figure's definition is the server's (`server/docs/integrations.md`);
 * the hints under the tiles restate the ones that would otherwise be
 * misread — that GMV excludes delivery and tax, and that money owed is
 * all-time rather than windowed.
 */
export function PlatformDashboard({ range }: { range: AnalyticsRange }) {
  const overview = usePlatformOverview(range);
  const revenue = usePlatformRevenue(range);

  if (overview.isError) {
    return <DashboardError error={overview.error} what="the dashboard" />;
  }

  if (!overview.data) {
    return <DashboardSkeleton />;
  }

  const { sales, today, vendors, customers, catalogue, payouts, fulfilment } =
    overview.data;

  // `isPlaceholderData` means these are the *previous* range's numbers, kept
  // on screen while the new ones load. Dimming says "catching up" rather than
  // letting stale figures pass as the answer.
  const dimmed = overview.isPlaceholderData;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Trade in this period
        </h2>
        <StatGrid className={dimmed ? "opacity-60 transition-opacity" : ""}>
          <StatCard
            label="GMV"
            value={formatCompactPrice(sales.gmv)}
            hint="Goods only, before delivery and tax"
          />
          <StatCard
            label="Platform revenue"
            value={formatCompactPrice(sales.commission)}
            hint="Commission on the same sales"
          />
          <StatCard
            label="Orders"
            value={formatCount(sales.orders)}
            hint={`${formatCount(sales.subOrders)} parcels across all shops`}
          />
          <StatCard
            label="Average order"
            value={formatPrice(sales.averageOrderValue)}
            hint={`${formatCount(sales.units)} units sold`}
          />
        </StatGrid>
      </section>

      {revenue.isError ? (
        <DashboardError error={revenue.error} what="the revenue chart" />
      ) : revenue.data ? (
        <SalesChart
          points={revenue.data.points}
          interval={revenue.data.interval}
          field="gmv"
          label="Gross merchandise value"
          dimmed={revenue.isPlaceholderData}
        />
      ) : (
        <Skeleton className="h-72 w-full rounded-xl" />
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Today so far
        </h2>
        <StatGrid>
          <StatCard label="Orders today" value={formatCount(today.orders)} />
          <StatCard label="GMV today" value={formatCompactPrice(today.gmv)} />
          <StatCard
            label="Commission today"
            value={formatCompactPrice(today.commission)}
          />
          <StatCard
            label="Units today"
            value={formatCount(today.units)}
            hint={`Measured in ${overview.data.range.timezone}`}
          />
        </StatGrid>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Money owed to shops
          </h2>
          <Link
            href={routes.admin.payouts}
            className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Payout queue
          </Link>
        </div>
        {/* Unwindowed on purpose: a sale from two months ago that has not been
            transferred is still owed, and a 30-day view would hide exactly the
            debts that have been outstanding longest. */}
        <StatGrid>
          <StatCard
            label="Payable now"
            value={formatCompactPrice(payouts.payable)}
            tone={payouts.payable > 0 ? "attention" : "default"}
            hint="Cleared and waiting for a run"
          />
          <StatCard
            label="In flight"
            value={formatCompactPrice(payouts.processing)}
            hint="Claimed by a payout"
          />
          <StatCard
            label="Not yet owed"
            value={formatCompactPrice(payouts.pending)}
            hint="Sold, not yet delivered"
          />
          <StatCard
            label="Paid all time"
            value={formatCompactPrice(payouts.paid)}
          />
        </StatGrid>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          The marketplace
        </h2>
        <StatGrid>
          <StatCard
            label="Shops awaiting review"
            value={formatCount(vendors.pending)}
            tone={vendors.pending > 0 ? "attention" : "default"}
            hint={
              <Link
                href={routes.admin.vendors}
                className="underline-offset-4 hover:text-foreground hover:underline"
              >
                Open the queue
              </Link>
            }
          />
          <StatCard
            label="Approved shops"
            value={formatCount(vendors.approved)}
            hint={`${formatCount(vendors.total)} in total`}
          />
          <StatCard
            label="Customers"
            value={formatCount(customers.total)}
            hint={`${formatCount(customers.newInRange)} new this period`}
          />
          <StatCard
            label="Listings"
            value={formatCount(catalogue.products)}
            hint={`${formatCount(catalogue.outOfStock)} out of stock`}
          />
        </StatGrid>
      </section>

      <FulfilmentStrip
        counts={fulfilment}
        href={routes.admin.orders}
        caption="Parcels still open across every shop."
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-8">
      <StatGrid>
        {[0, 1, 2, 3].map((tile) => (
          <Skeleton key={tile} className="h-24 rounded-xl" />
        ))}
      </StatGrid>
      <Skeleton className="h-72 w-full rounded-xl" />
      <StatGrid>
        {[0, 1, 2, 3].map((tile) => (
          <Skeleton key={tile} className="h-24 rounded-xl" />
        ))}
      </StatGrid>
    </div>
  );
}
