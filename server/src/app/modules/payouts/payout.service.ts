import { randomBytes } from "node:crypto";
import { Types, type QueryFilter } from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import { isDuplicateKeyError, money, NOT_DELETED } from "../../utils/mongo.js";
import { SubOrder, type PayoutState } from "../orders/sub-order.model.js";
import type { IUserDocument, UserRole } from "../users/user.model.js";
import { Vendor, type VendorDocument } from "../vendors/vendor.model.js";
import {
  Payout,
  type IPayout,
  type PayoutDocument,
  type PayoutStatus,
} from "./payout.model.js";
import type {
  CreatePayoutInput,
  ListMyPayoutsQuery,
  ListPayoutsQuery,
  MarkFailedInput,
  MarkPaidInput,
} from "./payout.validation.js";

/** How many times a collided payout number is regenerated. */
const PAYOUT_NUMBER_ATTEMPTS = 5;

/**
 * What a shop is owed, broken down by where each sub-order's money has got
 * to. The four figures answer four different questions a vendor actually
 * asks: what is coming, what is ready, what is in flight, what arrived.
 */
export interface VendorBalance {
  vendor: Types.ObjectId;
  /** Sold, but not yet delivered-and-paid — not owed yet. */
  pending: number;
  /** Earned and clear; the next payout run picks this up. */
  payable: number;
  /** Claimed by a payout that has not settled. */
  processing: number;
  /** Historic total actually transferred. */
  paid: number;
  /** Cancelled or refunded after the fact; never payable. */
  reversed: number;
  counts: Record<PayoutState, number>;
}

/** One row of the platform's "who do we owe?" screen. */
export interface PayableVendor {
  vendor: Types.ObjectId;
  name: string;
  slug: string;
  amount: number;
  subOrderCount: number;
  /** When the oldest unpaid sale was placed — the ageing signal. */
  oldestPlacedAt: Date;
}

export interface PayoutPage {
  data: PayoutDocument[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** Shape of the per-state aggregation, before it is folded into a balance. */
interface BalanceRow {
  _id: PayoutState;
  amount: number;
  count: number;
}

const ZERO_COUNTS: Record<PayoutState, number> = {
  PENDING: 0,
  PAYABLE: 0,
  PROCESSING: 0,
  PAID: 0,
  REVERSED: 0,
};

export class PayoutService {
  private static readonly PRIVILEGED_ROLES: readonly UserRole[] = [
    "ADMIN",
    "SUPER_ADMIN",
  ];

  /**
   * A payout is settled exactly once. `PAID` is terminal; `FAILED` is too,
   * because the money goes out again as a *new* run against the sub-orders
   * this one released — retrying in place would leave no record that the
   * first transfer was attempted.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<
    PayoutStatus,
    readonly PayoutStatus[]
  > = {
    PROCESSING: ["PAID", "FAILED"],
    PAID: [],
    FAILED: [],
  };

  // ---------- Queries: vendor ----------

  async getMyBalance(user: IUserDocument): Promise<VendorBalance> {
    const vendor = await PayoutService.vendorOf(user);
    return PayoutService.balanceOf(vendor._id);
  }

  async listMine(
    user: IUserDocument,
    query: ListMyPayoutsQuery,
  ): Promise<PayoutPage> {
    const vendor = await PayoutService.vendorOf(user);

    const filter: QueryFilter<IPayout> = { vendor: vendor._id };
    if (query.status) {
      filter.status = query.status;
    }

    return PayoutService.page(filter, query);
  }

  /** The sub-orders one payout settled — the vendor's line-by-line proof. */
  async getBreakdown(user: IUserDocument, id: string) {
    const payout = await this.getById(user, id);
    const subOrders = await SubOrder.find({ payout: payout._id })
      .select("subOrderNumber orderNumber placedAt pricing earnings status")
      .sort({ placedAt: 1 });

    return { payout, subOrders };
  }

  async getById(user: IUserDocument, id: string): Promise<PayoutDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound("Payout not found");
    }

    const payout = await Payout.findById(id);
    if (!payout) {
      throw ApiError.notFound("Payout not found");
    }

    if (PayoutService.PRIVILEGED_ROLES.includes(user.role)) {
      return payout;
    }

    const vendor = await PayoutService.vendorOf(user);
    if (!vendor._id.equals(payout.vendor)) {
      // A 403 would confirm that a payout with that id exists.
      throw ApiError.notFound("Payout not found");
    }

    return payout;
  }

  // ---------- Queries: admin ----------

  list(query: ListPayoutsQuery): Promise<PayoutPage> {
    const filter: QueryFilter<IPayout> = {};
    if (query.status) filter.status = query.status;
    if (query.vendor) filter.vendor = new Types.ObjectId(query.vendor);

    return PayoutService.page(filter, query);
  }

  /** Every shop with money waiting, largest debt first. */
  async listPayable(): Promise<PayableVendor[]> {
    return SubOrder.aggregate<PayableVendor>([
      { $match: { payoutState: "PAYABLE" } },
      {
        $group: {
          _id: "$vendor",
          amount: { $sum: "$earnings.vendorEarning" },
          subOrderCount: { $sum: 1 },
          oldestPlacedAt: { $min: "$placedAt" },
        },
      },
      {
        $lookup: {
          from: "vendors",
          localField: "_id",
          foreignField: "_id",
          as: "shop",
        },
      },
      { $unwind: "$shop" },
      {
        $project: {
          _id: 0,
          vendor: "$_id",
          name: "$shop.name",
          slug: "$shop.slug",
          amount: { $round: ["$amount", 2] },
          subOrderCount: 1,
          oldestPlacedAt: 1,
        },
      },
      { $sort: { amount: -1 } },
    ]);
  }

  balanceFor(vendorId: string): Promise<VendorBalance> {
    if (!Types.ObjectId.isValid(vendorId)) {
      throw ApiError.notFound("Shop not found");
    }
    return PayoutService.balanceOf(new Types.ObjectId(vendorId));
  }

  // ---------- Commands ----------

  /**
   * Starts a payout run for one shop.
   *
   * The order of operations is what makes this safe without transactions:
   * the payout row is inserted *first*, then it **claims** every payable
   * sub-order by stamping its id on them in a single `updateMany`, and only
   * then are the totals computed from what it actually claimed.
   *
   * Two runs launched at once therefore cannot pay the same sale twice —
   * the second claims nothing, because the first has already moved those
   * rows out of `PAYABLE`. A run that claims nothing deletes itself rather
   * than leaving an empty payout in the ledger.
   *
   * Totals are never taken from the caller or from a prior read: they are
   * summed from the claimed rows, so the figure transferred always matches
   * the sales it settles.
   */
  async create(
    actor: IUserDocument,
    { vendor: vendorId, notes }: CreatePayoutInput,
  ): Promise<PayoutDocument> {
    const vendor = await PayoutService.loadVendor(vendorId);

    const payout = await PayoutService.insert({
      vendor: vendor._id,
      subOrderCount: 0,
      grossAmount: 0,
      commissionAmount: 0,
      netAmount: 0,
      periodStart: null,
      periodEnd: new Date(),
      // Snapshot, not a reference: where the money went has to stay true
      // even after the vendor edits their bank details.
      account: vendor.payoutAccount,
      processedBy: actor._id,
      ...(notes !== undefined && { notes }),
    });

    const claimed = await SubOrder.updateMany(
      { vendor: vendor._id, payoutState: "PAYABLE" },
      { $set: { payoutState: "PROCESSING", payout: payout._id } },
    );

    if (claimed.modifiedCount === 0) {
      await Payout.deleteOne({ _id: payout._id });
      throw ApiError.conflict(
        "This shop has nothing payable right now — a payout may already be in progress",
      );
    }

    return PayoutService.totalise(payout);
  }

  /**
   * Records that the transfer went through.
   *
   * The guard on `status` is what stops two admins both marking one payout
   * paid, which would double-count it in the vendor's earnings history.
   */
  async markPaid(
    actor: IUserDocument,
    id: string,
    { reference, notes }: MarkPaidInput,
  ): Promise<PayoutDocument> {
    const payout = await PayoutService.loadForUpdate(id, "PAID");

    const updated = await Payout.findOneAndUpdate(
      { _id: payout._id, status: payout.status },
      {
        $set: {
          status: "PAID",
          reference,
          failureReason: null,
          processedBy: actor._id,
          processedAt: new Date(),
          ...(notes !== undefined && { notes }),
        },
      },
      { returnDocument: "after", runValidators: true },
    );

    if (!updated) {
      throw ApiError.conflict(
        "This payout changed while you were updating it — reload and try again",
      );
    }

    await SubOrder.updateMany(
      { payout: updated._id },
      { $set: { payoutState: "PAID" } },
    );

    return updated;
  }

  /**
   * Records that the transfer failed and releases the sales it held.
   *
   * The released sub-orders go back to `PAYABLE` so the next run picks them
   * up — except any that were cancelled while the transfer was in flight,
   * which are reversed instead. Nothing is owed for a parcel that came
   * back, and quietly re-queueing it would pay for goods the customer
   * returned.
   */
  async markFailed(
    actor: IUserDocument,
    id: string,
    { reason }: MarkFailedInput,
  ): Promise<PayoutDocument> {
    const payout = await PayoutService.loadForUpdate(id, "FAILED");

    const updated = await Payout.findOneAndUpdate(
      { _id: payout._id, status: payout.status },
      {
        $set: {
          status: "FAILED",
          failureReason: reason,
          processedBy: actor._id,
          processedAt: new Date(),
        },
      },
      { returnDocument: "after", runValidators: true },
    );

    if (!updated) {
      throw ApiError.conflict(
        "This payout changed while you were updating it — reload and try again",
      );
    }

    await SubOrder.updateMany(
      { payout: updated._id, status: { $ne: "CANCELLED" } },
      { $set: { payoutState: "PAYABLE", payout: null } },
    );

    await SubOrder.updateMany(
      { payout: updated._id, status: "CANCELLED" },
      { $set: { payoutState: "REVERSED", payout: null } },
    );

    return updated;
  }

  // ---------- Internals ----------

  private static async vendorOf(
    user: IUserDocument,
  ): Promise<VendorDocument> {
    const vendor = await Vendor.findOne({ owner: user._id, ...NOT_DELETED });
    if (!vendor) {
      throw ApiError.forbidden("You do not have a seller account");
    }
    return vendor;
  }

  private static async loadVendor(id: string): Promise<VendorDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound("Shop not found");
    }

    const vendor = await Vendor.findOne({ _id: id, ...NOT_DELETED });
    if (!vendor) {
      throw ApiError.notFound("Shop not found");
    }
    return vendor;
  }

  private static async loadForUpdate(
    id: string,
    next: PayoutStatus,
  ): Promise<PayoutDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound("Payout not found");
    }

    const payout = await Payout.findById(id);
    if (!payout) {
      throw ApiError.notFound("Payout not found");
    }

    if (!PayoutService.ALLOWED_TRANSITIONS[payout.status].includes(next)) {
      throw ApiError.conflict(
        `A payout that is already ${payout.status.toLowerCase()} cannot be marked ${next.toLowerCase()}`,
      );
    }

    return payout;
  }

  private static async balanceOf(
    vendorId: Types.ObjectId,
  ): Promise<VendorBalance> {
    const rows = await SubOrder.aggregate<BalanceRow>([
      { $match: { vendor: vendorId } },
      {
        $group: {
          _id: "$payoutState",
          amount: { $sum: "$earnings.vendorEarning" },
          count: { $sum: 1 },
        },
      },
    ]);

    const amounts = { ...ZERO_COUNTS };
    const counts = { ...ZERO_COUNTS };

    for (const row of rows) {
      amounts[row._id] = money(row.amount);
      counts[row._id] = row.count;
    }

    return {
      vendor: vendorId,
      pending: amounts.PENDING,
      payable: amounts.PAYABLE,
      processing: amounts.PROCESSING,
      paid: amounts.PAID,
      reversed: amounts.REVERSED,
      counts,
    };
  }

  private static async page(
    filter: QueryFilter<IPayout>,
    { page, limit }: ListMyPayoutsQuery,
  ): Promise<PayoutPage> {
    const [data, total] = await Promise.all([
      Payout.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Payout.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Sums what the run actually claimed and writes it onto the payout.
   *
   * Read back from the database rather than accumulated in memory: the
   * claim is the transaction boundary here, so the only trustworthy answer
   * to "what did this pay for?" is "whatever carries its id".
   */
  private static async totalise(
    payout: PayoutDocument,
  ): Promise<PayoutDocument> {
    const claimed = await SubOrder.find({ payout: payout._id }).select(
      "pricing earnings placedAt",
    );

    const grossAmount = money(
      claimed.reduce(
        (total, sub) => total + sub.pricing.subtotal + sub.pricing.shippingFee,
        0,
      ),
    );
    const commissionAmount = money(
      claimed.reduce((total, sub) => total + sub.earnings.commissionAmount, 0),
    );
    const netAmount = money(
      claimed.reduce((total, sub) => total + sub.earnings.vendorEarning, 0),
    );

    const periodStart = claimed.reduce<Date | null>(
      (earliest, sub) =>
        earliest === null || sub.placedAt < earliest ? sub.placedAt : earliest,
      null,
    );

    payout.set({
      subOrderCount: claimed.length,
      grossAmount,
      commissionAmount,
      netAmount,
      periodStart,
    });

    return payout.save();
  }

  /**
   * Inserts the payout, regenerating the reference if the random suffix
   * collides with an existing one.
   */
  private static async insert(
    data: Omit<
      IPayout,
      | "payoutNumber"
      | "status"
      | "reference"
      | "failureReason"
      | "notes"
      | "processedAt"
      | "createdAt"
      | "updatedAt"
    > & { notes?: string },
  ): Promise<PayoutDocument> {
    for (let attempt = 1; attempt <= PAYOUT_NUMBER_ATTEMPTS; attempt++) {
      try {
        return await Payout.create({
          ...data,
          payoutNumber: PayoutService.nextPayoutNumber(),
        });
      } catch (error) {
        if (!isDuplicateKeyError(error) || attempt === PAYOUT_NUMBER_ATTEMPTS) {
          throw error;
        }
      }
    }

    // Unreachable: the loop either returns or rethrows on its last pass.
    throw ApiError.conflict("Could not allocate a payout number");
  }

  /** `PO-20260901-K3F9QZ` — the same shape as an order number, one letter apart. */
  private static nextPayoutNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = randomBytes(5)
      .toString("base64url")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6)
      .padEnd(6, "0");

    return `PO-${date}-${suffix}`;
  }
}

export const payoutService = new PayoutService();
