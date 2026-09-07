import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import {
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/features/orders/components/order-status-badge";
import { SubOrderStatusControl } from "@/features/orders/components/sub-order-status-control";
import { getVendorSubOrder } from "@/features/orders/server/queues";
import { PAYOUT_STATE_LABELS } from "@/features/orders/types";
import { formatDateTime, formatPrice, pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Parcel" };

/**
 * One parcel, for the shop packing it.
 *
 * This is the merchant's counterpart to the customer's order page, and it
 * shows what that one cannot: the commission taken, what the shop is owed,
 * and where that money has got to. The API scopes the read to the caller's
 * own shop, so another shop's parcel comes back as `null` and 404s here —
 * confirming it existed would leak that a sub-order number is real.
 */
export default async function SellerParcelPage({
  params,
}: PageProps<"/seller/orders/[subOrderId]">) {
  const { subOrderId } = await params;
  const parcel = await getVendorSubOrder(subOrderId);

  if (!parcel) {
    notFound();
  }

  return (
    <>
      <div>
        <Button
          render={<Link href={routes.seller.orders} />}
          variant="ghost"
          size="sm"
        >
          <ArrowLeftIcon />
          All orders
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {parcel.subOrderNumber}
          </h1>
          <p className="text-sm text-muted-foreground">
            Placed {formatDateTime(parcel.placedAt)} · part of order{" "}
            {parcel.orderNumber}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <OrderStatusBadge status={parcel.status} />
          <PaymentStatusBadge status={parcel.paymentStatus} />
        </div>
      </header>

      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-base font-medium">Move it along</h2>
        <SubOrderStatusControl
          subOrderId={parcel._id}
          current={parcel.status}
        />
        {parcel.shipment.trackingNumber ? (
          <p className="text-sm text-muted-foreground">
            Sent with {parcel.shipment.courier ?? "a courier"} ·{" "}
            {parcel.shipment.trackingNumber}
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-base font-medium">
          {pluralize(parcel.items.length, "item")} to pack
        </h2>
        <ul className="flex flex-col divide-y">
          {parcel.items.map((item) => (
            <li
              key={item.productId}
              className="flex items-baseline justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {item.brand ? (
                  <p className="text-xs text-muted-foreground">{item.brand}</p>
                ) : null}
              </div>
              <div className="shrink-0 text-right text-sm tabular-nums">
                <p>
                  {item.quantity} × {formatPrice(item.price)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatPrice(item.lineTotal)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10">
        <h2 className="font-heading text-base font-medium">Your money</h2>
        {/* The figures are the ones frozen at checkout, including the
            commission rate that applied *then* — renegotiating a rate must
            not restate what was earned on a parcel already shipped. */}
        <dl className="grid gap-2 text-sm">
          <Row label="Goods">{formatPrice(parcel.pricing.subtotal)}</Row>
          <Row label="Delivery (passed through in full)">
            {formatPrice(parcel.pricing.shippingFee)}
          </Row>
          <Row
            label={`Platform commission (${String(Math.round(parcel.earnings.commissionRate * 100))}%)`}
          >
            −{formatPrice(parcel.earnings.commissionAmount)}
          </Row>
          <div className="mt-1 flex items-baseline justify-between border-t pt-2.5">
            <dt className="font-medium">You earn</dt>
            <dd className="font-heading text-lg font-semibold tabular-nums">
              {formatPrice(parcel.earnings.vendorEarning)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {PAYOUT_STATE_LABELS[parcel.payoutState]}.{" "}
          {parcel.payoutState === "PENDING"
            ? "Money becomes payable once the parcel is delivered."
            : null}
        </p>
      </section>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
