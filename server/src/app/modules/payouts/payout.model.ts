import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type Types,
} from "mongoose";
import {
  PAYOUT_METHODS,
  type IVendorPayoutAccount,
  type PayoutMethod,
} from "../vendors/vendor.model.js";

export type PayoutStatus = "PROCESSING" | "PAID" | "FAILED";

export const PAYOUT_STATUSES = [
  "PROCESSING",
  "PAID",
  "FAILED",
] as const satisfies readonly PayoutStatus[];

/**
 * One transfer of accumulated earnings to one vendor.
 *
 * The money the platform owes lives on the sub-orders (`vendorEarning`,
 * `payoutState`); this is the record of *settling* a batch of them. Keeping
 * the two separate is what makes the arithmetic auditable: a payout can be
 * re-read against the exact sub-orders it claimed, and a vendor disputing a
 * figure can be shown which orders it came from.
 *
 * The persisted shape only — deliberately not extending `Document`, for the
 * same reason as `IOrder`/`IVendor`.
 */
export interface IPayout {
  /** Human-quotable reference (`PO-20260901-K3F9QZ`); unique. */
  payoutNumber: string;
  vendor: Types.ObjectId;
  /** How many sub-orders this batch settled. */
  subOrderCount: number;
  /** Goods + delivery the vendor sold, before the platform's cut. */
  grossAmount: number;
  /** The platform's cut across the batch. */
  commissionAmount: number;
  /** What is actually transferred: `grossAmount − commissionAmount`. */
  netAmount: number;
  /** The window the claimed sub-orders were placed in. */
  periodStart: Date | null;
  periodEnd: Date;
  status: PayoutStatus;
  /**
   * A copy of the vendor's payout account as it was when the transfer was
   * made. A vendor who changes bank next month must not retroactively
   * change where last month's money appears to have gone.
   */
  account: IVendorPayoutAccount;
  /** The bank's or eSewa's own reference, once the transfer is made. */
  reference: string | null;
  failureReason: string | null;
  notes: string | null;
  processedBy: Types.ObjectId | null;
  processedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PayoutDocument = HydratedDocument<IPayout>;

const accountSnapshotSchema = new Schema<IVendorPayoutAccount>(
  {
    method: { type: String, enum: [...PAYOUT_METHODS], required: true },
    esewaId: { type: String, trim: true, default: null },
    bankName: { type: String, trim: true, default: null },
    accountName: { type: String, trim: true, default: null },
    accountNumber: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const payoutSchema = new Schema<IPayout>(
  {
    payoutNumber: {
      type: String,
      required: true,
      // `unique` already builds the index — adding `index: true` as well
      // makes Mongoose emit a duplicate-index warning at startup.
      unique: true,
    },

    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    subOrderCount: { type: Number, required: true, min: 0 },
    grossAmount: { type: Number, required: true, min: 0 },
    commissionAmount: { type: Number, required: true, min: 0 },
    netAmount: { type: Number, required: true, min: 0 },

    periodStart: { type: Date, default: null },
    periodEnd: { type: Date, required: true },

    status: {
      type: String,
      enum: [...PAYOUT_STATUSES],
      default: "PROCESSING",
    },

    account: { type: accountSnapshotSchema, required: true },

    reference: { type: String, trim: true, default: null },
    failureReason: { type: String, trim: true, default: null },
    notes: { type: String, trim: true, maxlength: 500, default: null },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// "This shop's payouts, newest first" — the vendor's earnings page.
payoutSchema.index({ vendor: 1, createdAt: -1 });

// The platform's payout queue, filtered by state.
payoutSchema.index({ status: 1, createdAt: -1 });

export type { PayoutMethod };

export const Payout = model<IPayout>("Payout", payoutSchema);
