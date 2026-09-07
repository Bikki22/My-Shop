"use client";

import Link from "next/link";
import { routes } from "@/config/routes";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactPrice, formatCount, formatPrice } from "@/lib/format";
import { VENDOR_STATUS_LABELS } from "@/features/vendors/types";
import { useMyOverview, useMySales } from "../hooks/use-dashboard-queries";
import type { AnalyticsRange } from "../types";
import { DashboardError } from "./dashboard-error";
import { FulfilmentStrip } from "./fulfilment-strip";
import { SalesChart } from "./sales-chart";
import { StatCard, StatGrid } from "./stat-card";

/**
 * One shop's dashboard, for the merchant who owns it.
 *
 * The same aggregation as the platform view, scoped by the server to the
 * caller's own vendor — which is why no shop id appears anywhere here. A
 * merchant cannot address anyone else's figures because there is nothing in
 * the request that says whose they are.
 *
 * The headline differs from the platform's on purpose: an operator leads with
 * GMV and commission (what the marketplace turned over and kept), a shop
 * leads with **its own earnings** — what it will actually be paid, after the
 * platform's cut and including the delivery it passes through.
 */
export function SellerDashboard({ range }: { range: AnalyticsRange }) {
  const overview = useMyOverview(range);
  const sales = useMySales(range);

  if (overview.isError) {
    return <DashboardError error={overview.error} what="your dashboard" />;
  }

  if (!overview.data) {
    return <DashboardSkeleton />;
  }

  const { vendor, sales: totals, today, payouts, catalogue, fulfilment } =
    overview.data;

  const dimmed = overview.isPlaceholderData;

  return (
    <div className="flex flex-col gap-8">
      {/* A shop that is not approved can still read its dashboard, so say why
          the numbers are not moving rather than showing four zeros with no
          explanation. */}
      {vendor.status !== "APPROVED" ? (
        <div className="rounded-xl bg-muted px-4 py-3 text-sm">
          <span className="font-semibold">
            {VENDOR_STATUS_LABELS[vendor.status]}.
          </span>{" "}
          <span className="text-muted-foreground">
            {vendor.status === "PENDING"
              ? "Your shop is not listed yet — an admin still has to review it."
              : "Your shop cannot take orders while it is in this state."}
          </span>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Your sales this period
        </h2>
        <StatGrid className={dimmed ? "opacity-60 transition-opacity" : ""}>
          <StatCard
            label="Your earnings"
            value={formatCompactPrice(totals.vendorEarnings)}
            hint="After commission, including delivery"
          />
          <StatCard
            label="Sold"
            value={formatCompactPrice(totals.gmv)}
            hint="Goods only, before delivery and tax"
          />
          <StatCard
            label="Orders"
            value={formatCount(totals.subOrders)}
            hint={`${formatCount(totals.units)} units`}
          />
          <StatCard
            label="Average order"
            value={formatPrice(totals.averageOrderValue)}
            hint={`${formatCompactPrice(totals.commission)} commission`}
          />
        </StatGrid>
      </section>

      {sales.isError ? (
        <DashboardError error={sales.error} what="your sales chart" />
      ) : sales.data ? (
        <SalesChart
          points={sales.data.points}
          interval={sales.data.interval}
          field="vendorEarnings"
          label="Your earnings"
          dimmed={sales.isPlaceholderData}
        />
      ) : (
        <Skeleton className="h-72 w-full rounded-xl" />
      )}

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Your money
          </h2>
          <Link
            href={routes.seller.payouts}
            className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Payout history
          </Link>
        </div>
        <StatGrid>
          <StatCard
            label="Ready to be paid"
            value={formatCompactPrice(payouts.payable)}
            hint="Cleared; in the next run"
          />
          <StatCard
            label="On its way"
            value={formatCompactPrice(payouts.processing)}
            hint="A transfer is in progress"
          />
          <StatCard
            label="Not yet owed"
            value={formatCompactPrice(payouts.pending)}
            hint="Sold, not yet delivered"
          />
          <StatCard
            label="Paid to date"
            value={formatCompactPrice(payouts.paid)}
          />
        </StatGrid>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground">
            Your listings
          </h2>
          <Link
            href={routes.seller.products}
            className="text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Manage products
          </Link>
        </div>
        <StatGrid className="lg:grid-cols-3">
          <StatCard label="Live listings" value={formatCount(catalogue.products)} />
          <StatCard
            label="Out of stock"
            value={formatCount(catalogue.outOfStock)}
            tone={catalogue.outOfStock > 0 ? "attention" : "default"}
            hint="Nobody can buy these"
          />
          <StatCard
            label="Running low"
            value={formatCount(catalogue.lowStock)}
            tone={catalogue.lowStock > 0 ? "attention" : "default"}
            hint="Five units or fewer"
          />
        </StatGrid>
      </section>

      <FulfilmentStrip
        counts={fulfilment}
        href={routes.seller.orders}
        caption="Parcels your shop still has to move."
      />

      <p className="text-xs text-muted-foreground">
        Today so far: {formatCount(today.subOrders)} orders,{" "}
        {formatPrice(today.vendorEarnings)} earned — measured in{" "}
        {overview.data.range.timezone}.
      </p>
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

