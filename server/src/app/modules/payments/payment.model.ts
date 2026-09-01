import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type Types,
} from "mongoose";

export type PaymentProvider = "ESEWA";

/**
 * The lifecycle of one *attempt*, which is not the same thing as the
 * order's `paymentStatus`: an order can accumulate several abandoned
 * attempts before one completes.
 */
export type PaymentState =
  | "INITIATED"
  | "PENDING"
  | "COMPLETE"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED";

export const PAYMENT_PROVIDERS = [
  "ESEWA",
] as const satisfies readonly PaymentProvider[];

export const PAYMENT_STATES = [
  "INITIATED",
  "PENDING",
  "COMPLETE",
  "FAILED",
  "CANCELED",
  "REFUNDED",
] as const satisfies readonly PaymentState[];

/**
 * One attempt to collect the money for an order.
 *
 * Kept separate from the order because the two answer different questions:
 * the order records *what the customer owes*, this records *what happened
 * at the gateway* — including the attempts that failed, which is exactly
 * what you need when a customer says they were charged and the order says
 * otherwise.
 */
export interface IPayment {
  order: Types.ObjectId;
  user: Types.ObjectId;
  provider: PaymentProvider;
  /**
   * Our reference for the attempt, sent to eSewa as `transaction_uuid` and
   * echoed back in the callback. Unique — it is what makes a replayed
   * redirect settle the same attempt instead of a second one.
   */
  transactionUuid: string;
  /** What we asked the gateway to collect, in NPR. */
  amount: number;
  state: PaymentState;
  /** eSewa's `ref_id` / `transaction_code`, once there is one. */
  referenceId: string | null;
  /** eSewa's own status string, kept verbatim for support tickets. */
  providerStatus: string | null;
  failureReason: string | null;
  settledAt: Date | null;
  /**
   * The last payload the gateway sent us. Card details never reach this
   * server — eSewa collects them on its own domain — so this is safe to
   * keep, and it is the only evidence in a dispute.
   */
  raw: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentDocument = HydratedDocument<IPayment>;

const paymentSchema = new Schema<IPayment>(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      index: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    provider: {
      type: String,
      enum: [...PAYMENT_PROVIDERS],
      required: true,
    },

    transactionUuid: {
      type: String,
      required: true,
      // `unique` already builds the index — adding `index: true` as well
      // makes Mongoose emit a duplicate-index warning at startup.
      unique: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0, "Amount cannot be negative"],
    },

    state: {
      type: String,
      enum: [...PAYMENT_STATES],
      default: "INITIATED",
    },

    referenceId: { type: String, default: null },
    providerStatus: { type: String, default: null },
    failureReason: { type: String, default: null },
    settledAt: { type: Date, default: null },

    raw: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true },
);

// The reconciliation sweep is always "attempts still open, oldest first".
paymentSchema.index({ state: 1, createdAt: 1 });

export const Payment = model<IPayment>("Payment", paymentSchema);
