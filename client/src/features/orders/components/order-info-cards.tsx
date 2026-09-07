import { CreditCardIcon, MapPinIcon, StickyNoteIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addressLines, PAYMENT_METHOD_LABELS } from "../lib/format";
import type { Order } from "../types";
import { PaymentStatusBadge } from "./order-status-badge";

/**
 * Where it is going and how it was paid for — the two facts a customer
 * checks first when something looks wrong.
 *
 * The address is the copy frozen on the order, not the account's current
 * one: the parcel is going where it was addressed, and showing today's
 * address would misrepresent a delivery already in motion.
 */
export function OrderInfoCards({ order }: { order: Order }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <InfoCard icon={<MapPinIcon className="size-3.5" />} label="Delivery address">
        <address className="not-italic">
          {addressLines(order.shippingAddress).map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </address>
      </InfoCard>

      <InfoCard icon={<CreditCardIcon className="size-3.5" />} label="Payment">
        <span className="block font-medium">
          {PAYMENT_METHOD_LABELS[order.paymentMethod]}
        </span>
        <PaymentStatusBadge status={order.paymentStatus} className="mt-2" />
        <span className="mt-2 block text-xs text-muted-foreground">
          Placed {formatDateTime(order.placedAt)}
        </span>
      </InfoCard>

      {order.notes ? (
        <InfoCard
          icon={<StickyNoteIcon className="size-3.5" />}
          label="Delivery notes"
          className="sm:col-span-2"
        >
          {order.notes}
        </InfoCard>
      ) : null}
    </div>
  );
}

function InfoCard({
  icon,
  label,
  children,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-2xl bg-card p-4 ring-1 ring-foreground/10", className)}
    >
      <h3 className="flex items-center gap-1.5 text-[0.6875rem] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        <span aria-hidden>{icon}</span>
        {label}
      </h3>
      <div className="mt-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}
