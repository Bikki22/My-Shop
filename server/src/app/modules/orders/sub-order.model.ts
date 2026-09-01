import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type Types,
} from "mongoose";
import {
  orderItemSchema,
  orderPricingSchema,
  orderStatusEventSchema,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  type IOrderItem,
  type IOrderPricing,
  type IOrderStatusEvent,
  type OrderStatus,
  type PaymentMethod,
  type PaymentStatus,
} from "./order.model.js";

/**
 * Where one vendor's share of an order sits on its way to their bank.
 *
 * Separate from `paymentStatus`, which says whether the *customer* paid.
 * The customer paying and the vendor being paid are weeks apart in a
 * marketplace, and conflating them is how a platform pays out money it has
 * since refunded.
 */
export type PayoutState =
  | "PENDING"
  | "PAYABLE"
  | "PROCESSING"
  | "PAID"
  | "REVERSED";

export const PAYOUT_STATES = [
  "PENDING",
  "PAYABLE",
  "PROCESSING",
  "PAID",
  "REVERSED",
] as const satisfies readonly PayoutState[];

/**
 * The split of one sub-order's money, frozen at checkout.
 *
 * `commissionRate` is stored rather than looked up because it is the rate
 * that was agreed *at the time of sale*. Renegotiating a vendor's rate must
 * not silently restate what they earned on orders they already shipped.
 */
export interface ISubOrderEarnings {
  commissionRate: number;
  /** The platform's cut, taken from the goods subtotal only. */
  commissionAmount: number;
  /**
   * What the vendor is owed: subtotal − commission + shipping.
   *
   * Delivery is passed through in full: the vendor pays the courier, so
   * commissioning it would charge them a percentage of their own costs.
   */
  vendorEarning: number;
}

/** Courier details, once the parcel is on its way. */
export interface ISubOrderShipment {
  courier: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
}

/**
 * One vendor's portion of a customer's order.
 *
 * This is the unit the marketplace actually operates on. A customer places
 * *one* order and pays *once*, but three shops each pack their own parcel,
 * mark it shipped on their own schedule, cancel independently when they run
 * out, and are paid separately. Modelling that as one flat order with a
 * single status forces every shop to move in lockstep and leaves nowhere to
 * record what each is owed.
 *
 * The parent `Order` keeps what is shared — the customer, the address, the
 * payment. Everything that can differ per shop lives here.
 *
 * The persisted shape only — deliberately not extending `Document`, for the
 * same reason as `IOrder`/`IProduct`.
 */
export interface ISubOrder {
  order: Types.ObjectId;
  /** The parent's reference, denormalised so support can search one field. */
  orderNumber: string;
  /** `ORD-20260901-K3F9QZ-1`; unique, and what the vendor quotes. */
  subOrderNumber: string;
  user: Types.ObjectId;
  vendor: Types.ObjectId;
  items: IOrderItem[];
  pricing: IOrderPricing;
  earnings: ISubOrderEarnings;
  status: OrderStatus;
  /** Mirrors the parent order: the customer pays once, for everything. */
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  statusHistory: IOrderStatusEvent[];
  shipment: ISubOrderShipment;
  payoutState: PayoutState;
  /** Set once a payout run picks this up. */
  payout: Types.ObjectId | null;
  placedAt: Date;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SubOrderDocument = HydratedDocument<ISubOrder>;

const earningsSchema = new Schema<ISubOrderEarnings>(
  {
    commissionRate: { type: Number, required: true, min: 0, max: 1 },
    commissionAmount: { type: Number, required: true, min: 0 },
    vendorEarning: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const shipmentSchema = new Schema<ISubOrderShipment>(
  {
    courier: { type: String, trim: true, default: null },
    trackingNumber: { type: String, trim: true, default: null },
    shippedAt: { type: Date, default: null },
  },
  { _id: false },
);

const subOrderSchema = new Schema<ISubOrder>(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    orderNumber: { type: String, required: true },

    subOrderNumber: {
      type: String,
      required: true,
      // `unique` already builds the index — adding `index: true` as well
      // makes Mongoose emit a duplicate-index warning at startup.
      unique: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: IOrderItem[]) => items.length > 0,
        message: "A sub-order must have at least one item",
      },
    },

    pricing: { type: orderPricingSchema, required: true },
    earnings: { type: earningsSchema, required: true },

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

    statusHistory: { type: [orderStatusEventSchema], default: [] },

    shipment: {
      type: shipmentSchema,
      default: () => ({ courier: null, trackingNumber: null, shippedAt: null }),
    },

    payoutState: {
      type: String,
      enum: [...PAYOUT_STATES],
      default: "PENDING",
    },

    payout: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payout",
      default: null,
    },

    placedAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, trim: true, default: null },
  },
  { timestamps: true },
);

// The vendor's order queue: "my shop's orders, newest first", with an
// optional status filter riding the same index prefix.
subOrderSchema.index({ vendor: 1, status: 1, createdAt: -1 });

// The payout run: "everything this shop is owed but hasn't been paid".
subOrderSchema.index({ vendor: 1, payoutState: 1 });

// The platform-wide fulfilment queue.
subOrderSchema.index({ status: 1, createdAt: -1 });

// A stock audit, and "which shops sold this product".
subOrderSchema.index({ "items.productId": 1 });

export const SubOrder = model<ISubOrder>("SubOrder", subOrderSchema);
