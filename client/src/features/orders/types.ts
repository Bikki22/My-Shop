/**
 * Mirrors `IOrder` and `ISubOrder` from the server's `modules/orders/` as
 * they arrive over the wire: `ObjectId`s are serialized to strings and every
 * `Date` to an ISO string.
 *
 * The shape to understand before reading any of it: a customer places **one
 * order** and pays once, but it is split into **one sub-order per shop** —
 * each with its own items, its own parcel, its own fulfilment status and its
 * own cancellation. The parent order carries what is shared (the address,
 * the payment, the totals) and a status *derived* from its parts; the items
 * themselves only exist on the sub-orders.
 *
 * That is why `GET /orders` (the list) can show a total and a status but no
 * items, and why every single-order read answers with `{ order, subOrders }`.
 */

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["COD", "CARD", "ESEWA"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * A purchased line — the exact inverse of a cart line.
 *
 * The name, brand, image and price are a *snapshot* taken at checkout, not
 * a join against the live product, so a later price change, rename or
 * deletion cannot rewrite what was agreed. `productId` is kept only as a
 * link back to the (possibly gone) listing.
 */
export interface OrderItem {
  productId: string;
  name: string;
  brand: string | null;
  image: string | null;
  /** Unit price at the moment of checkout. */
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** Every money figure the customer was shown, frozen at checkout. */
export interface OrderPricing {
  subtotal: number;
  shippingFee: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
}

export interface OrderStatusEvent {
  status: OrderStatus;
  at: string;
  note: string | null;
  /** Null when the transition was made by the system rather than a person. */
  by: string | null;
}

export interface Order {
  _id: string;
  /** Human-quotable reference, `ORD-20260901-K3F9QZ`. */
  orderNumber: string;
  user: string;
  shippingAddress: ShippingAddress;
  pricing: OrderPricing;
  /** How many shops this order was split across, and how many lines total. */
  vendorCount: number;
  itemCount: number;
  /** Derived from the sub-orders: an order is only as far along as its
   *  least-advanced shop. */
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  statusHistory: OrderStatusEvent[];
  notes: string | null;
  placedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Courier details, once the parcel is on its way. */
export interface SubOrderShipment {
  courier: string | null;
  trackingNumber: string | null;
  shippedAt: string | null;
}

/**
 * One shop's portion of an order.
 *
 * The wire also carries an `earnings` block (the platform's commission and
 * what the shop is owed). It is deliberately absent here: it is nobody's
 * business on a customer-facing screen, and typing it would invite a
 * component to render it.
 */
export interface SubOrder {
  _id: string;
  order: string;
  orderNumber: string;
  /** `ORD-20260901-K3F9QZ-1` — what the shop quotes. */
  subOrderNumber: string;
  user: string;
  vendor: string;
  items: OrderItem[];
  pricing: OrderPricing;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  statusHistory: OrderStatusEvent[];
  shipment: SubOrderShipment;
  placedAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

/** An order and its per-shop parts — every single-order read answers this. */
export interface OrderDetail {
  order: Order;
  subOrders: SubOrder[];
}

/**
 * The orders list envelope.
 *
 * Note it is *not* the `Paginated<T>` shape the catalogue uses: the orders
 * module paginates by hand (`{ data, pagination }`) rather than through
 * `mongoose-aggregate-paginate-v2`, so it needs its own type.
 */
export interface OrderPage {
  data: Order[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const ORDER_SORTS = [
  "newest",
  "oldest",
  "total_desc",
  "total_asc",
] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

/** The query for "my orders", in the shape the UI thinks about it. */
export interface OrderFilters {
  status: OrderStatus | null;
  sort: OrderSort;
  page: number;
  limit: number;
}

export const DEFAULT_ORDER_FILTERS: OrderFilters = {
  status: null,
  sort: "newest",
  page: 1,
  limit: 10,
};

/** The body `POST /orders` accepts. Notably absent: items, and any money. */
export interface CreateOrderInput {
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export const emptyOrderPage = (limit: number): OrderPage => ({
  data: [],
  pagination: { page: 1, limit, total: 0, pages: 0 },
});
