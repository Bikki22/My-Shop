import Link from "next/link";
import { AlertTriangleIcon, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { formatPrice, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CartSummary as CartSummaryData } from "../types";

/**
 * The sticky order summary, and the only route to checkout.
 *
 * There is no promo-code box: the API has no discount concept, and an input
 * that always answers "invalid code" is worse than no input at all. The
 * server's `pricing` does carry a `discountTotal`, so if promotions land
 * later this is where the row goes.
 */
export function CartSummary({
  summary,
  isRecalculating = false,
}: {
  summary: CartSummaryData;
  /**
   * True while a cart write is in flight.
   *
   * The optimistic update in `useCart` patches quantities but deliberately
   * not the money — delivery is per shop and waived above a threshold, so a
   * quantity change can flip a fee. These figures are last-known until the
   * server's recalculated cart lands, and they say so rather than asserting a
   * total that may be about to change.
   */
  isRecalculating?: boolean;
}) {
  const blocked = summary.hasIssues;

  return (
    <aside className="flex flex-col gap-4 self-start rounded-2xl bg-card p-5 ring-1 ring-foreground/10 lg:sticky lg:top-20">
      <h2 className="font-heading text-lg font-semibold">Order summary</h2>

      <dl
        aria-busy={isRecalculating || undefined}
        className={cn(
          "flex flex-col gap-2.5 text-sm transition-opacity",
          isRecalculating && "opacity-60",
        )}
      >
        <Row label={`Subtotal (${pluralize(summary.totalQuantity, "item")})`}>
          {formatPrice(summary.subtotal)}
        </Row>
        <Row
          label={
            summary.vendorCount > 1
              ? `Delivery (${pluralize(summary.vendorCount, "shop")})`
              : "Delivery"
          }
        >
          {summary.shippingFee === 0 ? "Free" : formatPrice(summary.shippingFee)}
        </Row>

        <div className="my-1 border-t" />

        <div className="flex items-center justify-between gap-3">
          <dt className="text-base font-semibold">Total</dt>
          <dd className="font-mono text-xl font-bold tabular-nums">
            {formatPrice(summary.grandTotal)}
          </dd>
        </div>
      </dl>

      {blocked ? (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-xs font-medium text-destructive">
          <AlertTriangleIcon className="mt-px size-3.5 shrink-0" aria-hidden />
          Some items can&apos;t be ordered. Remove or reduce them to continue.
        </p>
      ) : null}

      {/* Rendered as a disabled button rather than a dead link when the cart
          can't be checked out: the reason is stated above it, and a link that
          silently goes nowhere reads as a broken page. */}
      {blocked ? (
        <Button size="lg" className="h-12 w-full" disabled>
          Proceed to checkout
        </Button>
      ) : (
        <Button
          render={<Link href={routes.checkout} />}
          size="lg"
          className="h-12 w-full"
        >
          Proceed to checkout
        </Button>
      )}

      <div className="flex flex-wrap justify-center gap-1.5 text-[0.6875rem] text-muted-foreground">
        {["eSewa", "Cash on delivery"].map((method) => (
          <span key={method} className="rounded-md border px-2 py-1">
            {method}
          </span>
        ))}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <LockIcon className="size-3" aria-hidden />
        Prices and stock are confirmed when you order
      </p>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono font-semibold tabular-nums">{children}</dd>
    </div>
  );
}
