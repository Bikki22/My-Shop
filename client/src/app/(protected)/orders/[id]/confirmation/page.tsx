import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon, StoreIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { requireUser } from "@/features/auth/server/guards";
import { CheckoutSteps } from "@/features/orders/components/checkout-steps";
import { OrderInfoCards } from "@/features/orders/components/order-info-cards";
import { OrderItems } from "@/features/orders/components/order-items";
import { OrderPricingSummary } from "@/features/orders/components/order-pricing-summary";
import { getOrder } from "@/features/orders/server/orders";
import { PayWithEsewaButton } from "@/features/payments/components/pay-with-esewa-button";
import { getVendorSummaries } from "@/features/vendors/server/vendors";
import { pluralize } from "@/lib/format";

export const metadata: Metadata = { title: "Order confirmed" };

/**
 * The receipt, shown once immediately after checkout.
 *
 * Deliberately a separate route from the order page rather than a banner on
 * it: this is a page a shopper reads and leaves, and it says the things that
 * are only true at this moment ("a confirmation is on its way", "here is
 * what happens next"). Everything ongoing — trackers, courier details,
 * cancelling — lives on the order page, which this links to.
 */
export default async function OrderConfirmationPage({
  params,
}: PageProps<"/orders/[id]/confirmation">) {
  // Before the read: a layout and its page render concurrently, so without
  // this a guest's request goes out while the layout's guard is still deciding.
  // `requireUser()` is `cache()`d, so it costs nothing.
  await requireUser();

  const { id } = await params;
  const detail = await getOrder(id);

  if (!detail) notFound();

  const { order, subOrders } = detail;
  const vendors = await getVendorSummaries(
    subOrders.map((subOrder) => subOrder.vendor),
  );

  const unpaidEsewa =
    order.paymentMethod === "ESEWA" && order.paymentStatus !== "PAID";

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="flex justify-center">
        <CheckoutSteps current="Confirmation" />
      </div>

      <header className="mt-8 flex flex-col items-center gap-2.5 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckIcon className="size-8" aria-hidden />
        </span>

        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Order placed
        </h1>
        <p className="text-sm text-muted-foreground">
          A confirmation is on its way to your email.
        </p>
        <p className="font-mono text-base font-bold">{order.orderNumber}</p>
      </header>

      {/* An eSewa order reaches this page unpaid whenever the redirect was
          abandoned or the gateway could not be opened. Saying so here — with
          the way to fix it — is the difference between a recoverable order
          and one the shopper thinks is done. */}
      {unpaidEsewa ? (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-2xl bg-amber-500/10 p-4 text-center">
          <p className="text-sm">
            <span className="font-semibold">Payment not completed.</span> Your
            items are reserved — pay now to have the shops start packing.
          </p>
          <PayWithEsewaButton orderId={order._id} />
        </div>
      ) : null}

      <section className="mt-6 flex flex-col gap-5 rounded-2xl bg-card p-5 ring-1 ring-foreground/10">
        {subOrders.map((subOrder) => {
          const vendor = vendors.get(subOrder.vendor);

          return (
            <div key={subOrder._id} className="flex flex-col gap-3">
              <h2 className="flex items-center gap-2 text-xs font-bold">
                <StoreIcon
                  className="size-3.5 text-muted-foreground"
                  aria-hidden
                />
                {vendor?.name ?? "Shop"}
                <span className="ml-auto font-mono text-[0.6875rem] font-medium text-muted-foreground">
                  {subOrder.subOrderNumber}
                </span>
              </h2>

              <OrderItems items={subOrder.items} size="sm" />
            </div>
          );
        })}

        <div className="border-t pt-4">
          <OrderPricingSummary
            pricing={order.pricing}
            totalLabel={
              order.paymentStatus === "PAID" ? "Total paid" : "Total due"
            }
          />
        </div>
      </section>

      <div className="mt-5">
        <OrderInfoCards order={order} />
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button
          render={<Link href={routes.order(order._id)} />}
          size="lg"
          className="h-12 flex-1 basis-40"
        >
          Track this order
        </Button>
        <Button
          render={<Link href={routes.products} />}
          variant="outline"
          size="lg"
          className="h-12 flex-1 basis-40"
        >
          Continue shopping
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="font-heading text-base font-semibold">
          What happens next
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          <Step number={1} title="Each shop packs its own parcel">
            {order.vendorCount > 1
              ? `Your order is split across ${pluralize(order.vendorCount, "shop")}, and each hands off to a courier on its own schedule.`
              : "The shop will confirm your order and prepare it for the courier."}
          </Step>
          <Step number={2} title="You get shipping updates">
            Every parcel gets its own tracker on the order page, with courier
            and tracking number once it is on the way.
          </Step>
          <Step number={3} title="Delivered to your door">
            {order.paymentMethod === "COD"
              ? "Inspect your items before paying the courier."
              : "You can cancel any parcel that has not shipped yet."}
          </Step>
        </ol>
      </section>
    </div>
  );
}

function Step({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
        {number}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{children}</span>
      </span>
    </li>
  );
}
