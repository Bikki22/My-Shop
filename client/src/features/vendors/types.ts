/**
 * Mirrors the public projection of `IVendor` on the server — the fields
 * `PUBLIC_FIELDS` in `modules/vendors/vendor.service.ts` selects.
 *
 * Everything a shop would not want published (KYC documents, payout account,
 * the negotiated commission rate) is absent there, and so absent here.
 */
export interface VendorSummary {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl: string | null;
  bannerUrl?: string | null;
  productCount: number;
  ratingAverage: number;
  ratingCount: number;
  createdAt: string;
}

/**
 * The lifecycle of a selling account. Mirrors `VENDOR_STATUSES`.
 *
 * `PENDING` is where every application starts and is the only status an
 * admin cannot *choose* — a shop returns to it by re-applying, never by
 * being pushed back.
 */
export const VENDOR_STATUSES = [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const;
export type VendorStatus = (typeof VENDOR_STATUSES)[number];

/** The outcomes `PATCH /vendors/admin/:id/review` accepts. */
export const REVIEW_OUTCOMES = [
  "APPROVED",
  "REJECTED",
  "SUSPENDED",
] as const satisfies readonly VendorStatus[];
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const PAYOUT_METHODS = ["ESEWA", "BANK"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/**
 * Where the platform sends a shop's money.
 *
 * A discriminated union on the server, and kept as one here: "method BANK
 * with no account number" has to be impossible to submit rather than a
 * support ticket on the first payout run.
 */
export type PayoutAccount =
  | { method: "ESEWA"; esewaId: string }
  | {
      method: "BANK";
      bankName: string;
      accountName: string;
      accountNumber: string;
    };

export interface VendorAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface VendorKycDocument {
  label: string;
  url: string;
  uploadedAt?: string;
}

/**
 * The full shop record, as its owner and as staff see it.
 *
 * A superset of `VendorSummary`: this adds everything the public projection
 * withholds — the payout account, the KYC documents, the negotiated
 * commission rate and the review trail. Never render it on a public page.
 */
export interface Vendor extends VendorSummary {
  owner: string;
  email: string;
  phone: string;
  address: VendorAddress;
  status: VendorStatus;
  /** `null` means "use the platform default" rather than "no commission". */
  commissionRate: number | null;
  payoutAccount: PayoutAccount;
  documents: VendorKycDocument[];
  reviewedAt: string | null;
  reviewedBy: string | null;
  rejectionReason: string | null;
  suspensionReason: string | null;
  updatedAt: string;
}

/** What the application form collects. Mirrors `applyVendorBodySchema`. */
export interface ApplyVendorInput {
  name: string;
  description?: string;
  email: string;
  phone: string;
  address: VendorAddress;
  payoutAccount: PayoutAccount;
}

/**
 * Self-service edits. `name` is absent on purpose: the storefront slug is
 * derived from it, and a URL that changes under customers' feet breaks every
 * link pointing at the shop. Renaming is an admin action.
 */
export type UpdateMyVendorInput = Partial<Omit<ApplyVendorInput, "name">>;

/** The admin queue's query, as the UI thinks about it. */
export interface VendorFilters {
  status: VendorStatus | null;
  search: string;
  page: number;
  limit: number;
}

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  PENDING: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
};
