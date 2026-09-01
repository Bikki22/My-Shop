import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type Types,
} from "mongoose";

export type VendorStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type PayoutMethod = "ESEWA" | "BANK";

/**
 * Single source of truth for the allowed values: the Mongoose enums and the
 * Zod schemas both read these, so the two can't drift apart. Declared as
 * const tuples so `z.enum` keeps the literal union instead of widening to
 * `string`.
 */
export const VENDOR_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const satisfies readonly VendorStatus[];

export const PAYOUT_METHODS = [
  "ESEWA",
  "BANK",
] as const satisfies readonly PayoutMethod[];

/**
 * The one status in which a vendor may list products and receive orders.
 * Everything that gates selling compares against this rather than spelling
 * the literal out, so widening the rule later is a one-line change.
 */
export const SELLABLE_STATUS: VendorStatus = "APPROVED";

/** Where the platform sends this vendor's share of the money. */
export interface IVendorPayoutAccount {
  method: PayoutMethod;
  /** Set for `ESEWA`, null for `BANK`. */
  esewaId: string | null;
  bankName: string | null;
  accountName: string | null;
  accountNumber: string | null;
}

export interface IVendorAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/** One uploaded registration/KYC document. */
export interface IVendorKycDocument {
  label: string;
  url: string;
  uploadedAt: Date;
}

/**
 * A selling account on the marketplace.
 *
 * Kept separate from `User` rather than folded into it: a user is an
 * identity and a vendor is a *business* — it has its own name, storefront,
 * legal address, bank details, commission rate and approval lifecycle, and
 * all of that is meaningless for the 99% of users who only ever buy. The
 * `MERCHANT` role on the user records *that* they sell; this records
 * everything about how.
 *
 * The persisted shape only — deliberately not extending `Document`, for the
 * same reason as `IProduct`/`IOrder`.
 */
export interface IVendor {
  /** The user who owns this shop. One shop per account. */
  owner: Types.ObjectId;
  name: string;
  /** Storefront URL segment; unique across the marketplace. */
  slug: string;
  description: string;
  logoUrl: string | null;
  bannerUrl: string | null;
  /** Business contact, not the owner's login email — they differ often. */
  email: string;
  phone: string;
  address: IVendorAddress;
  status: VendorStatus;
  /**
   * Fraction of each sale the platform keeps, e.g. `0.1` for 10%.
   * `null` means "use the platform default" — a negotiated rate is the
   * exception, so storing the default on every vendor would just be a
   * thousand copies to migrate the day it changes.
   */
  commissionRate: number | null;
  payoutAccount: IVendorPayoutAccount;
  documents: IVendorKycDocument[];
  /** When an admin last approved/rejected/suspended, and who. */
  reviewedAt: Date | null;
  reviewedBy: Types.ObjectId | null;
  rejectionReason: string | null;
  suspensionReason: string | null;
  /** Denormalised storefront counters, maintained by their own modules. */
  productCount: number;
  ratingAverage: number;
  ratingCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type VendorDocument = HydratedDocument<IVendor>;

const payoutAccountSchema = new Schema<IVendorPayoutAccount>(
  {
    method: { type: String, enum: [...PAYOUT_METHODS], required: true },
    esewaId: { type: String, trim: true, default: null },
    bankName: { type: String, trim: true, default: null },
    accountName: { type: String, trim: true, default: null },
    accountNumber: { type: String, trim: true, default: null },
  },
  { _id: false },
);

const addressSchema = new Schema<IVendorAddress>(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true, default: null },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const kycDocumentSchema = new Schema<IVendorKycDocument>(
  {
    label: { type: String, required: true, trim: true, maxlength: 60 },
    url: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const vendorSchema = new Schema<IVendor>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // One shop per account. `unique` already builds the index — adding
      // `index: true` as well makes Mongoose warn about a duplicate.
      unique: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, "Shop name must be at least 2 characters"],
      maxlength: [60, "Shop name cannot exceed 60 characters"],
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      unique: true,
      match: [
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug may only contain lowercase letters, numbers and single hyphens",
      ],
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    logoUrl: { type: String, default: null },
    bannerUrl: { type: String, default: null },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },

    phone: { type: String, required: true, trim: true },

    address: { type: addressSchema, required: true },

    status: {
      type: String,
      enum: [...VENDOR_STATUSES],
      default: "PENDING",
      index: true,
    },

    commissionRate: {
      type: Number,
      default: null,
      min: [0, "Commission rate cannot be negative"],
      max: [1, "Commission rate cannot exceed 1 (100%)"],
    },

    payoutAccount: { type: payoutAccountSchema, required: true },

    documents: { type: [kycDocumentSchema], default: [] },

    reviewedAt: { type: Date, default: null },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejectionReason: { type: String, trim: true, default: null },
    suspensionReason: { type: String, trim: true, default: null },

    productCount: { type: Number, default: 0, min: 0 },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },

    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// The admin approval queue is always "filter by status, oldest first" —
// the longest-waiting application should be the one on top.
vendorSchema.index({ status: 1, createdAt: 1 });

// The public directory: approved shops, best rated first.
vendorSchema.index({ status: 1, ratingAverage: -1 });

vendorSchema.index({ name: "text", description: "text" });

export const Vendor = model<IVendor>("Vendor", vendorSchema);
