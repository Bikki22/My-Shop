import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type Types,
} from "mongoose";

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type PaymentMethod = "COD" | "CARD" | "ESEWA";

/**
 * Single source of truth for the allowed values: the Mongoose enums and the
 * Zod schemas both read these, so the two can't drift apart. Declared as
 * const tuples so `z.enum` keeps the literal union instead of widening to
 * `string`.
 */
export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const satisfies readonly OrderStatus[];

export const PAYMENT_STATUSES = [
  "PENDING",
  "PAID",
  "FAILED",
  "REFUNDED",
] as const satisfies readonly PaymentStatus[];

export const PAYMENT_METHODS = [
  "COD",
  "CARD",
  "ESEWA",
] as const satisfies readonly PaymentMethod[];

/** Methods settled through a gateway before fulfilment, not on delivery. */
export const PREPAID_METHODS = [
  "CARD",
  "ESEWA",
] as const satisfies readonly PaymentMethod[];

/** A checkout larger than this is almost certainly a scripted client. */
export const MAX_ORDER_ITEMS = 50;

/**
 * One purchased line.
 *
 * This is the exact inverse of `ICartItem`, and deliberately so: a cart
 * stores intent and prices it live, while an order is a *record of what was
 * agreed*. The name, image and price are copied in at checkout so a later
 * price change, rename or deletion of the product cannot rewrite history —
 * `productId` is kept only as a link back to the (possibly gone) product.
 */
export interface IOrderItem {
  productId: Types.ObjectId;
  name: string;
  brand: string | null;
  image: string | null;
  /** Unit price at the moment of checkout. */
  price: number;
  quantity: number;
  lineTotal: number;
}

export interface IShippingAddress {
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
export interface IOrderPricing {
  subtotal: number;
  shippingFee: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
}

/** One entry in the order's audit trail. */
export interface IOrderStatusEvent {
  status: OrderStatus;
  at: Date;
  note: string | null;
  /** Null when the transition was made by the system rather than a person. */
  by: Types.ObjectId | null;
}

/**
 * The persisted shape only — deliberately not extending `Document`, for the
 * same reason as `IProduct`/`ICart`.
 */
export interface IOrder {
  /** Human-quotable reference (`ORD-20260901-K3F9QZ`); unique. */
  orderNumber: string;
  user: Types.ObjectId;
  shippingAddress: IShippingAddress;
  /** The whole basket's money, summed from the sub-orders. */
  pricing: IOrderPricing;
  /** How many shops this order was split across, and how many lines total. */
  vendorCount: number;
  itemCount: number;
  /**
   * Derived from the sub-orders, never set directly — an order is only as
   * far along as its least-advanced shop. See `OrderService.deriveStatus`.
   */
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  statusHistory: IOrderStatusEvent[];
  notes: string | null;
  placedAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderDocument = HydratedDocument<IOrder>;

/**
 * Exported because `SubOrder` stores the same shapes. Sharing the schema
 * objects rather than redeclaring them is what keeps a line, a price
 * breakdown or a history entry identical on both sides of the split.
 */
export const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Never populated on read: these fields *are* the snapshot, and
    // resolving them against the live product would defeat the whole
    // point of taking one.
    name: { type: String, required: true, trim: true },
    brand: { type: String, trim: true, default: null },
    image: { type: String, default: null },

    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },

    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
    },

    lineTotal: {
      type: Number,
      required: true,
      min: [0, "Line total cannot be negative"],
    },
  },
  // The line is identified by its productId; a generated `_id` per
  // subdocument would just be noise the client has to carry around.
  { _id: false },
);

const shippingAddressSchema = new Schema<IShippingAddress>(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: null },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },
  { _id: false },
);

export const orderPricingSchema = new Schema<IOrderPricing>(
  {
    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, required: true, min: 0, default: 0 },
    taxTotal: { type: Number, required: true, min: 0, default: 0 },
    discountTotal: { type: Number, required: true, min: 0, default: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

export const orderStatusEventSchema = new Schema<IOrderStatusEvent>(
  {
    status: { type: String, enum: [...ORDER_STATUSES], required: true },
    at: { type: Date, default: Date.now },
    note: { type: String, trim: true, default: null },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: {
      type: String,
      required: true,
      // `unique` already builds the index — adding `index: true` as well
      // makes Mongoose emit a duplicate-index warning at startup. It is
      // also what turns a collided random suffix into a retry in the
      // service instead of two customers quoting the same reference.
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // The lines themselves live on the sub-orders — one set per shop. What
    // stays here is the shape of the split, so a list of orders can render
    // "3 items from 2 shops" without joining every sub-order.
    vendorCount: { type: Number, required: true, min: 1 },
    itemCount: {
      type: Number,
      required: true,
      min: [1, "An order must have at least one item"],
      max: [
        MAX_ORDER_ITEMS,
        `An order cannot contain more than ${String(MAX_ORDER_ITEMS)} items`,
      ],
    },

    shippingAddress: { type: shippingAddressSchema, required: true },

    pricing: { type: orderPricingSchema, required: true },

    status: {
      type: String,
      enum: [...ORDER_STATUSES],
      default: "PENDING",
    },

    paymentStatus: {
      type: String,
      enum: [...PAYMENT_STATUSES],
      default: "PENDING",
    },

    paymentMethod: {
      type: String,
      enum: [...PAYMENT_METHODS],
      required: true,
    },

    statusHistory: {
      type: [orderStatusEventSchema],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [500, "Notes cannot exceed 500 characters"],
      default: null,
    },

    placedAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

// "My orders, newest first" — an optional status filter still uses this
// prefix, so it needs no index of its own.
orderSchema.index({ user: 1, createdAt: -1 });

// The admin queues are always "filter by state, then newest first".
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ paymentStatus: 1, createdAt: -1 });

// A product's sales history is answered from `SubOrder` now — that is
// where the lines live, and its `items.productId` index covers it.

// Orders are never deleted — cancelling is a status, not a removal — so
// unlike products and categories there is no `deletedAt` here, and reads
// need no soft-delete filter.
export const Order = model<IOrder>("Order", orderSchema);
