import Link from "next/link";
import { PackageIcon, StoreIcon, TruckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PRODUCT_FILTERS,
  productsHref,
} from "@/features/products/lib/product-filters";
import type { VendorSummary } from "@/features/vendors/types";
import { formatDate, formatPrice, pluralize } from "@/lib/format";
import { isCancellable } from "../lib/format";
import type { SubOrder } from "../types";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { OrderItems } from "./order-items";
import { OrderPricingSummary } from "./order-pricing-summary";
import { OrderStatusBadge } from "./order-status-badge";
import { OrderTracker } from "./order-tracker";

/**
 * One shop's parcel: its items, its own tracker, its own cancel button.
 *
 * Per-shop rather than per-order because that is how the marketplace
 * actually works — one shop can ship while another is still packing, and
 * cancelling here cancels *this* parcel and leaves the rest of the order
 * standing.
 */
export function SubOrderCard({
  subOrder,
  vendor,
}: {
  subOrder: SubOrder;
  /** Resolved separately: a sub-order carries only the shop's id. */
  vendor: VendorSummary | undefined;
}) {
  const { shipment } = subOrder;

  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-muted/40 px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <StoreIcon className="size-3.5" aria-hidden />
        </span>

        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">
            {vendor ? (
              <Link
                href={productsHref({
                  ...DEFAULT_PRODUCT_FILTERS,
                  vendor: vendor._id,
                })}
                className="underline-offset-2 hover:underline"
              >
                {vendor.name}
              </Link>
            ) : (
              "Shop"
            )}
          </h2>
          <p className="font-mono text-[0.6875rem] text-muted-foreground">
            {subOrder.subOrderNumber}
          </p>
        </div>

        <OrderStatusBadge status={subOrder.status} className="ml-auto" />
      </header>

      <div className="flex flex-col gap-5 p-4">
        <OrderItems items={subOrder.items} />

        <OrderTracker order={subOrder} cancelReason={subOrder.cancelReason} />

        {/* Only once a courier has it: before that there is nothing to look
            up, and an empty tracking panel reads as a lost parcel. */}
        {shipment.trackingNumber || shipment.courier ? (
          <dl className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-muted/40 px-3 py-2.5 text-xs">
            <div className="flex items-center gap-1.5">
              <TruckIcon className="size-3.5 text-muted-foreground" aria-hidden />
              <dt className="text-muted-foreground">Courier</dt>
              <dd className="font-medium">{shipment.courier ?? "—"}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <PackageIcon className="size-3.5 text-muted-foreground" aria-hidden />
              <dt className="text-muted-foreground">Tracking</dt>
              <dd className="font-mono font-medium">
                {shipment.trackingNumber ?? "—"}
              </dd>
            </div>
            {shipment.shippedAt ? (
              <div className="flex items-center gap-1.5">
                <dt className="text-muted-foreground">Shipped</dt>
                <dd className="font-medium">{formatDate(shipment.shippedAt)}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {pluralize(subOrder.items.length, "item")} ·{" "}
            {subOrder.pricing.shippingFee === 0
              ? "free delivery"
              : `${formatPrice(subOrder.pricing.shippingFee)} delivery`}
          </p>

          <OrderPricingSummary
            pricing={subOrder.pricing}
            totalLabel="Parcel total"
            className="w-full sm:max-w-56"
          />
        </div>

        {isCancellable(subOrder.status) ? (
          <div className="flex flex-wrap gap-2 border-t pt-4">
            <CancelOrderDialog
              target={{ kind: "sub-order", id: subOrder._id }}
              title="Cancel this parcel?"
              description="Only this shop's items are cancelled. The rest of your order carries on, and any stock goes back on the shelf."
              trigger={
                <Button variant="outline" size="sm">
                  Cancel this parcel
                </Button>
              }
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
