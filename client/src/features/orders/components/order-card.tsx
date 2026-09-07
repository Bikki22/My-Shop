import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { formatDate, formatPrice, pluralize } from "@/lib/format";
import { isCancellable, PAYMENT_METHOD_LABELS } from "../lib/format";
import type { Order } from "../types";
import { CancelOrderDialog } from "./cancel-order-dialog";
import { OrderStatusBadge, PaymentStatusBadge } from "./order-status-badge";
import { OrderTracker } from "./order-tracker";

/**
 * One row of the order history.
 *
 * It shows a total, a derived status and a tracker but *no items*, and that
 * is the API's shape rather than an omission: the lines live on the
 * sub-orders, so listing them here would mean a second request per order.
 * "3 items from 2 shops" is what the parent order actually knows, and the
 * detail page is one click away for the rest.
 */
export function OrderCard({ order }: { order: Order }) {
  return (
    <article className="overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/10">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b bg-muted/40 px-4 py-3">
        <Field label="Order">
          <span className="font-mono">{order.orderNumber}</span>
        </Field>
        <Field label="Placed">{formatDate(order.placedAt)}</Field>
        <Field label="Contents">
          {pluralize(order.itemCount, "item")} ·{" "}
          {pluralize(order.vendorCount, "shop")}
        </Field>
        <Field label="Total">
          <span className="font-mono">
            {formatPrice(order.pricing.grandTotal)}
          </span>
        </Field>

        <OrderStatusBadge status={order.status} className="ml-auto" />
      </header>

      <div className="flex flex-col gap-5 p-4">
        {/* No per-step dates: a parent order carries only its derived
            status, not the times its shops moved. The header already says
            when it was placed, and the detail page has a dated tracker per
            parcel. */}
        <OrderTracker
          order={order}
          cancelReason={order.cancelReason}
          showDates={false}
        />

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <PaymentStatusBadge status={order.paymentStatus} />
          <span className="text-xs text-muted-foreground">
            {PAYMENT_METHOD_LABELS[order.paymentMethod]}
          </span>

          <div className="ml-auto flex flex-wrap gap-2">
            {isCancellable(order.status) ? (
              <CancelOrderDialog
                target={{ kind: "order", id: order._id }}
                title="Cancel this order?"
                description="Every part that has not shipped yet is cancelled and the stock goes back. Anything already with a courier keeps going — cancel those parcels individually."
                trigger={
                  <Button variant="outline" size="sm">
                    Cancel order
                  </Button>
                }
              />
            ) : null}

            <Button render={<Link href={routes.order(order._id)} />} size="sm">
              Track order
              <ChevronRightIcon data-icon="inline-end" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="text-[0.6875rem] text-muted-foreground">
      {label}
      <span className="mt-0.5 block text-xs font-semibold text-foreground">
        {children}
      </span>
    </div>
  );
}
