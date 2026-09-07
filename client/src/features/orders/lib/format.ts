import type {
  OrderStatus,
  OrderStatusEvent,
  PaymentMethod,
  PaymentStatus,
  ShippingAddress,
} from "../types";

/**
 * How each state is named and coloured, in one place.
 *
 * The server's vocabulary is warehouse vocabulary — `PROCESSING` means a
 * shop is packing a box. These labels say that in the words a shopper would
 * use, and the tone maps onto the design's three status pills (amber for
 * in-flight, teal for done, rust for cancelled).
 */
export type StatusTone = "pending" | "active" | "done" | "cancelled";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Order placed",
  CONFIRMED: "Confirmed",
  PROCESSING: "Being packed",
  SHIPPED: "In transit",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  PENDING: "pending",
  CONFIRMED: "active",
  PROCESSING: "active",
  SHIPPED: "active",
  DELIVERED: "done",
  CANCELLED: "cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
};

export const PAYMENT_STATUS_TONES: Record<PaymentStatus, StatusTone> = {
  PENDING: "pending",
  PAID: "done",
  FAILED: "cancelled",
  REFUNDED: "cancelled",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  COD: "Cash on delivery",
  CARD: "Debit / credit card",
  ESEWA: "eSewa wallet",
};

export const PAYMENT_METHOD_HINTS: Record<PaymentMethod, string> = {
  COD: "Pay the courier when your parcel arrives",
  CARD: "Visa and Mastercard",
  ESEWA: "Pay now from your eSewa wallet",
};

/**
 * The Tailwind classes for a tone. Kept as a lookup rather than inline
 * conditionals so a badge, a tracker dot and a timeline entry all read the
 * same colour from one decision.
 */
export const TONE_CLASSES: Record<StatusTone, string> = {
  pending: "bg-muted text-muted-foreground",
  active: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  done: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive",
};

/** Whether the customer can still cancel — mirrors `CUSTOMER_CANCELLABLE`. */
const CANCELLABLE: readonly OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
];

/**
 * Past `SHIPPED` the parcel is with a courier, so cancelling is support's
 * job, not a button's. Mirrored from the server rather than guessed, because
 * offering a control the API will refuse is worse than not offering it.
 */
export const isCancellable = (status: OrderStatus): boolean =>
  CANCELLABLE.includes(status);

/** Anything a customer can act on, for deciding whether to show a footer. */
export const isOpen = (status: OrderStatus): boolean =>
  status !== "DELIVERED" && status !== "CANCELLED";

// ---------- The tracker ----------

/** The four milestones the design's tracker shows, in order. */
export const TRACKER_STAGES = [
  "Placed",
  "Packed",
  "Shipped",
  "Delivered",
] as const;

/** Which stages each status has reached — `CANCELLED` reaches none. */
const REACHED: Record<OrderStatus, number> = {
  PENDING: 1,
  CONFIRMED: 2,
  PROCESSING: 2,
  SHIPPED: 3,
  DELIVERED: 4,
  CANCELLED: 0,
};

export interface TrackerStep {
  label: string;
  /** Already happened. */
  done: boolean;
  /** The furthest step reached — the one to highlight. */
  current: boolean;
  /** When it happened, ISO, or null if it hasn't. */
  at: string | null;
}

/** The subset of an order (or sub-order) a tracker needs. */
export interface Trackable {
  status: OrderStatus;
  placedAt: string;
  deliveredAt: string | null;
  statusHistory: OrderStatusEvent[];
}

const firstEventAt = (
  history: OrderStatusEvent[],
  ...statuses: OrderStatus[]
): string | null =>
  history.find((event) => statuses.includes(event.status))?.at ?? null;

/**
 * Builds the tracker from the order's own audit trail.
 *
 * Times come from `statusHistory` rather than being estimated: the design
 * shows "Est. Jul 12" under a future step, but the API records no promised
 * delivery date, and inventing one would be a commitment the marketplace
 * never made. Steps that have not happened simply have no timestamp.
 */
export function trackerSteps(order: Trackable): TrackerStep[] {
  const reached = REACHED[order.status];

  const times: (string | null)[] = [
    order.placedAt,
    firstEventAt(order.statusHistory, "CONFIRMED", "PROCESSING"),
    firstEventAt(order.statusHistory, "SHIPPED"),
    order.deliveredAt ?? firstEventAt(order.statusHistory, "DELIVERED"),
  ];

  return TRACKER_STAGES.map((label, index) => {
    const step = index + 1;
    return {
      label,
      done: step <= reached,
      current: step === reached,
      at: step <= reached ? times[index] : null,
    };
  });
}

// ---------- Addresses ----------

/** The address as a set of lines, for a `<address>` block. */
export const addressLines = (address: ShippingAddress): string[] =>
  [
    address.fullName,
    address.line1,
    address.line2,
    `${address.city}, ${address.state} ${address.postalCode}`,
    address.country,
    address.phone,
  ].filter((line): line is string => Boolean(line));

/** One-line form, for a summary row where a block would be too much. */
export const addressSummary = (address: ShippingAddress): string =>
  [address.line1, address.line2, address.city, address.state]
    .filter(Boolean)
    .join(", ");
