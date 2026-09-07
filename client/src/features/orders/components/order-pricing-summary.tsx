import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrderPricing } from "../types";

/**
 * The frozen money breakdown of an order or one of its parts.
 *
 * Tax and discount rows appear only when they are non-zero. The marketplace
 * currently charges no tax and has no promotions, and a permanent
 * "Discount — Rs. 0" row is just noise that will start telling the truth on
 * its own the day either is switched on.
 */
export function OrderPricingSummary({
  pricing,
  totalLabel = "Total",
  className,
}: {
  pricing: OrderPricing;
  totalLabel?: string;
  className?: string;
}) {
  return (
    <dl className={cn("flex flex-col gap-2 text-sm", className)}>
      <Row label="Subtotal">{formatPrice(pricing.subtotal)}</Row>
      <Row label="Delivery">
        {pricing.shippingFee === 0 ? "Free" : formatPrice(pricing.shippingFee)}
      </Row>
      {pricing.taxTotal > 0 ? (
        <Row label="Tax">{formatPrice(pricing.taxTotal)}</Row>
      ) : null}
      {pricing.discountTotal > 0 ? (
        <Row label="Discount" tone="text-emerald-600 dark:text-emerald-400">
          – {formatPrice(pricing.discountTotal)}
        </Row>
      ) : null}

      <div className="my-1 border-t" />

      <div className="flex items-center justify-between gap-3">
        <dt className="font-semibold">{totalLabel}</dt>
        <dd className="font-mono text-lg font-bold tabular-nums">
          {formatPrice(pricing.grandTotal)}
        </dd>
      </div>
    </dl>
  );
}

function Row({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono font-semibold tabular-nums", tone)}>
        {children}
      </dd>
    </div>
  );
}
