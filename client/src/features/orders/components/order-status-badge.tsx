import { cn } from "@/lib/utils";
import type { OrderStatus, PaymentStatus } from "../types";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  TONE_CLASSES,
} from "../lib/format";

/**
 * The design's status pill: a coloured dot and a label.
 *
 * Not the `Badge` primitive, because that has no dot and its variants are
 * semantic (`destructive`, `secondary`) rather than the four fulfilment
 * tones this needs.
 */
function Pill({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONE_CLASSES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full bg-current opacity-80"
      />
      {children}
    </span>
  );
}

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <Pill tone={ORDER_STATUS_TONES[status]} className={className}>
      {ORDER_STATUS_LABELS[status]}
    </Pill>
  );
}

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  return (
    <Pill tone={PAYMENT_STATUS_TONES[status]} className={className}>
      {PAYMENT_STATUS_LABELS[status]}
    </Pill>
  );
}
