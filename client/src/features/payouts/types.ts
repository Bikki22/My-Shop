/**
 * Mirrors `IPayout` and the payout service's projections from the server's
 * `modules/payouts/`, as they arrive over the wire.
 *
 * The shape to understand first: the money a shop is owed lives on the
 * **sub-orders** (`earnings.vendorEarning` plus a `payoutState`), and a
 * `Payout` is the record of *settling a batch of them*. Keeping the two
 * separate is what makes the arithmetic auditable — a payout can be re-read
 * against the exact parcels it claimed, so a shop disputing a figure can be
 * shown which orders it came from.
 */

import type { PayoutAccount } from "@/features/vendors/types";
import type { PayoutState } from "@/features/orders/types";

export const PAYOUT_STATUSES = ["PROCESSING", "PAID", "FAILED"] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

/**
 * One transfer to one shop.
 *
 * `account` is a *snapshot* of where the money went, not a reference: a shop
 * that changes bank next month must not retroactively change where last
 * month's money appears to have gone.
 */
export interface Payout {
  _id: string;
  /** `PO-20260901-K3F9QZ` — the reference both sides quote. */
  payoutNumber: string;
  vendor: string;
  subOrderCount: number;
  /** Goods + delivery sold, before the platform's cut. */
  grossAmount: number;
  commissionAmount: number;
  /** What is actually transferred: `grossAmount − commissionAmount`. */
  netAmount: number;
  periodStart: string | null;
  periodEnd: string;
  status: PayoutStatus;
  account: PayoutAccount;
  /** The bank's or eSewa's own reference, once the transfer is made. */
  reference: string | null;
  failureReason: string | null;
  notes: string | null;
  processedBy: string | null;
  processedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * What a shop is owed, split by where each parcel's money has got to.
 *
 * The four figures answer four different questions a merchant actually asks:
 * what is coming, what is ready, what is in flight, what arrived.
 */
export interface VendorBalance {
  vendor: string;
  /** Sold, but not yet delivered-and-cleared — not owed yet. */
  pending: number;
  /** Earned and clear; the next run picks this up. */
  payable: number;
  /** Claimed by a payout that has not settled. */
  processing: number;
  paid: number;
  /** Cancelled or refunded after the fact; never payable. */
  reversed: number;
  counts: Record<PayoutState, number>;
}

/** One row of the platform's "who do we owe?" screen. */
export interface PayableVendor {
  vendor: string;
  name: string;
  slug: string;
  amount: number;
  subOrderCount: number;
  /** When the oldest unpaid sale was placed — the ageing signal. */
  oldestPlacedAt: string;
}

export interface PayoutPage {
  data: Payout[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const emptyPayoutPage = (limit: number): PayoutPage => ({
  data: [],
  pagination: { page: 1, limit, total: 0, pages: 0 },
});

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  PROCESSING: "In progress",
  PAID: "Paid",
  FAILED: "Failed",
};

export type { PayoutAccount, PayoutState };
