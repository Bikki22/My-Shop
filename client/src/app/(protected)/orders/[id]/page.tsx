import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { requireUser } from "@/features/auth/server/guards";
import { OrderInfoCards } from "@/features/orders/components/order-info-cards";
import { OrderPricingSummary } from "@/features/orders/components/order-pricing-summary";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { SubOrderCard } from "@/features/orders/components/sub-order-card";
import { getOrder } from "@/features/orders/server/orders";
import { PayWithEsewaButton } from "@/features/payments/components/pay-with-esewa-button";
import { getVendorSummaries } from "@/features/vendors/server/vendors";
import { formatDate, pluralize } from "@/lib/format";

export async function generateMetadata({
  params,
}: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const detail = await getOrder(id);

  return {
    title: detail ? `Order ${detail.order.orderNumber}` : "Order not found",
  };
}

/**
 * One order, parcel by parcel.
 *
 * This is where the marketplace's shape becomes visible: the page renders a
 * card per **sub-order**, each with its own items, tracker, courier details
 * and cancel button, because each is a different shop working to its own
 * schedule. The parent order contributes what is shared — the address, the
 * payment, the total.
 *
 * `getOrder` answers `null` for an order that does not exist *and* for one
 * belonging to someone else, so both become the same 404 — confirming the
 * difference would leak that an order number is real.
 */
export default async function OrderPage({ params }: PageProps<"/orders/[id]">) {
  // Before the read: a layout and its page render concurrently, so without
  // this a guest's request goes out while the layout's guard is still deciding.
  // `requireUser()` is `cache()`d, so it costs nothing.
  await requireUser();

  const { id } = await params;
  const detail = await getOrder(id);

  if (!detail) notFound();

  const { order, subOrders } = detail;

  // A sub-order carries only its shop's id, so the names are resolved in one
  // parallel batch rather than a request per card.
  const vendors = await getVendorSummaries(
    subOrders.map((subOrder) => subOrder.vendor),
  );

  const awaitingEsewa =
    order.paymentMethod === "ESEWA" &&
    (order.paymentStatus === "PENDING" || order.paymentStatus === "FAILED") &&
    order.status !== "CANCELLED";

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Button
        render={<Link href={routes.orders} />}
        variant="ghost"
        size="sm"
        className="-ml-2.5"
      >
        <ChevronLeftIcon data-icon="inline-start" aria-hidden />
        All orders
      </Button>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Order{" "}
            <span className="font-mono text-xl">{order.orderNumber}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDate(order.placedAt)} ·{" "}
            {pluralize(order.itemCount, "item")} from{" "}
            {pluralize(order.vendorCount, "shop")}
          </p>
        </div>

        <OrderStatusBadge status={order.status} />
      </header>

      {/* The recovery path for a payment that never completed: the order
          exists and is holding stock, so it has to stay payable. */}
      {awaitingEsewa ? (
        <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl bg-amber-500/10 p-4">
          <p className="min-w-0 flex-1 text-sm">
            <span className="font-semibold">This order is not paid yet.</span>{" "}
            Your items are reserved — finish the eSewa payment to have them
            shipped.
          </p>
          <PayWithEsewaButton orderId={order._id} />
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        {subOrders.map((subOrder) => (
          <SubOrderCard
            key={subOrder._id}
            subOrder={subOrder}
            vendor={vendors.get(subOrder.vendor)}
          />
        ))}
      </div>

      <section className="mt-6 flex flex-col gap-4">
        <OrderInfoCards order={order} />

        <div className="rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
          <h2 className="mb-3 font-heading text-base font-semibold">
            Order total
          </h2>
          <OrderPricingSummary
            pricing={order.pricing}
            totalLabel={order.paymentStatus === "PAID" ? "Total paid" : "Total"}
          />
          {order.vendorCount > 1 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Delivery is charged per parcel — {order.vendorCount} shops means{" "}
              {order.vendorCount} deliveries.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
