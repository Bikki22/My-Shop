import { randomBytes } from "node:crypto";
import { Types, type QueryFilter } from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import {
  duplicateKeyField,
  escapeRegex,
  NOT_DELETED,
  omitUndefined,
  slugify,
} from "../../utils/mongo.js";
import {
  User,
  type IUserDocument,
  type UserRole,
} from "../users/user.model.js";
import {
  SELLABLE_STATUS,
  Vendor,
  type IVendor,
  type IVendorPayoutAccount,
  type VendorDocument,
  type VendorStatus,
} from "./vendor.model.js";
import type {
  ApplyVendorInput,
  ListVendorsAdminQuery,
  ListVendorsQuery,
  PayoutAccountInput,
  RenameVendorInput,
  ReviewVendorInput,
  UpdateCommissionInput,
  UpdateMyVendorInput,
} from "./vendor.validation.js";

/** How many times a collided slug is regenerated before giving up. */
const SLUG_ATTEMPTS = 5;

/**
 * Fields the public directory and storefront expose. The payout account,
 * the KYC documents, the negotiated commission rate and the review notes
 * are all deliberately absent — publishing a vendor's bank details or the
 * cut they negotiated would be a real leak, not a cosmetic one.
 */
const PUBLIC_FIELDS =
  "name slug description logoUrl bannerUrl productCount ratingAverage ratingCount createdAt";

export interface VendorPage {
  data: VendorDocument[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/** The union input, flattened into the shape the model stores. */
const toPayoutAccount = (input: PayoutAccountInput): IVendorPayoutAccount =>
  input.method === "ESEWA"
    ? {
        method: "ESEWA",
        esewaId: input.esewaId,
        bankName: null,
        accountName: null,
        accountNumber: null,
      }
    : {
        method: "BANK",
        esewaId: null,
        bankName: input.bankName,
        accountName: input.accountName,
        accountNumber: input.accountNumber,
      };

export class VendorService {
  private static readonly PRIVILEGED_ROLES: readonly UserRole[] = [
    "ADMIN",
    "SUPER_ADMIN",
  ];

  /**
   * The approval state machine, spelled out. Everything not listed is
   * refused, so a new status can never accidentally become reachable from
   * everywhere.
   *
   * `PENDING` has no admin-driven predecessor on purpose: an application
   * goes back to pending only by its owner re-submitting it (`apply`),
   * never by an admin pushing it backwards.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<
    VendorStatus,
    readonly VendorStatus[]
  > = {
    PENDING: ["APPROVED", "REJECTED"],
    APPROVED: ["SUSPENDED"],
    REJECTED: ["APPROVED"],
    SUSPENDED: ["APPROVED"],
  };

  private static readonly SORT_STAGES: Record<
    ListVendorsQuery["sort"],
    Record<string, 1 | -1>
  > = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    name_asc: { name: 1 },
    rating_desc: { ratingAverage: -1 },
  };

  // ---------- Public storefront ----------

  /** The shop directory: approved shops only, public fields only. */
  list(query: ListVendorsQuery): Promise<VendorPage> {
    return VendorService.page(
      VendorService.buildFilter({ ...query, status: SELLABLE_STATUS }),
      query,
      PUBLIC_FIELDS,
    );
  }

  async getBySlug(slug: string): Promise<VendorDocument> {
    const vendor = await Vendor.findOne({
      slug,
      status: SELLABLE_STATUS,
      ...NOT_DELETED,
    }).select(PUBLIC_FIELDS);

    if (!vendor) {
      throw ApiError.notFound("Shop not found");
    }
    return vendor;
  }

  async getPublicById(id: string): Promise<VendorDocument> {
    const vendor = await Vendor.findOne({
      _id: VendorService.toObjectId(id, "Shop not found"),
      status: SELLABLE_STATUS,
      ...NOT_DELETED,
    }).select(PUBLIC_FIELDS);

    if (!vendor) {
      throw ApiError.notFound("Shop not found");
    }
    return vendor;
  }

  // ---------- Self-service ----------

  /**
   * Submits (or re-submits) an application.
   *
   * A rejected application is *reused* rather than a second one inserted:
   * `owner` is unique, so a fresh insert would trip the index, and keeping
   * the same document means the admin who rejected it can see the history
   * on the row they already know.
   */
  async apply(
    user: IUserDocument,
    input: ApplyVendorInput,
  ): Promise<VendorDocument> {
    const existing = await Vendor.findOne({ owner: user._id });

    if (existing && existing.status !== "REJECTED") {
      throw ApiError.conflict(
        existing.status === "PENDING"
          ? "Your seller application is already under review"
          : "You already have a shop on this marketplace",
      );
    }

    const payload = {
      name: input.name,
      description: input.description,
      logoUrl: input.logoUrl ?? null,
      bannerUrl: input.bannerUrl ?? null,
      email: input.email,
      phone: input.phone,
      address: { ...input.address, line2: input.address.line2 ?? null },
      payoutAccount: toPayoutAccount(input.payoutAccount),
      documents: input.documents.map((document) => ({
        ...document,
        uploadedAt: new Date(),
      })),
    };

    if (existing) {
      existing.set({
        ...payload,
        status: "PENDING",
        rejectionReason: null,
        suspensionReason: null,
        reviewedAt: null,
        reviewedBy: null,
      });
      return existing.save();
    }

    return VendorService.insertWithSlug({ ...payload, owner: user._id });
  }

  /** The caller's own shop, whatever its status — private fields included. */
  async getMine(user: IUserDocument): Promise<VendorDocument> {
    const vendor = await Vendor.findOne({ owner: user._id, ...NOT_DELETED });
    if (!vendor) {
      throw ApiError.notFound("You do not have a seller account yet");
    }
    return vendor;
  }

  async updateMine(
    user: IUserDocument,
    input: UpdateMyVendorInput,
  ): Promise<VendorDocument> {
    const vendor = await this.getMine(user);

    const { address, payoutAccount, documents, ...rest } = input;

    const update: Record<string, unknown> = omitUndefined(rest);

    if (address) {
      update["address"] = { ...address, line2: address.line2 ?? null };
    }
    if (payoutAccount) {
      update["payoutAccount"] = toPayoutAccount(payoutAccount);
    }
    if (documents) {
      update["documents"] = documents.map((document) => ({
        ...document,
        uploadedAt: new Date(),
      }));
    }

    const updated = await Vendor.findByIdAndUpdate(
      vendor._id,
      { $set: update },
      { returnDocument: "after", runValidators: true },
    );

    // It existed a moment ago, so a miss means it was removed concurrently.
    if (!updated) {
      throw ApiError.notFound("You do not have a seller account yet");
    }
    return updated;
  }

  /**
   * Loads the caller's shop and asserts it may sell right now.
   *
   * Every seller-only write goes through here, so the rule cannot drift
   * between products, orders and payouts — and the message tells the
   * vendor what to do next rather than a bare "Forbidden".
   */
  async requireSellingVendor(user: IUserDocument): Promise<VendorDocument> {
    const vendor = await Vendor.findOne({ owner: user._id, ...NOT_DELETED });

    if (!vendor) {
      throw ApiError.forbidden(
        "You need a seller account to do this. Apply from the Become a Vendor page.",
      );
    }

    if (vendor.status !== SELLABLE_STATUS) {
      throw ApiError.forbidden(VendorService.blockedMessage(vendor));
    }

    return vendor;
  }

  // ---------- Admin ----------

  /** The approval queue: every shop, every status. */
  adminList(query: ListVendorsAdminQuery): Promise<VendorPage> {
    return VendorService.page(VendorService.buildFilter(query), query);
  }

  async adminGetById(id: string): Promise<VendorDocument> {
    const vendor = await Vendor.findOne({
      _id: VendorService.toObjectId(id, "Shop not found"),
      ...NOT_DELETED,
    });

    if (!vendor) {
      throw ApiError.notFound("Shop not found");
    }
    return vendor;
  }

  /**
   * Approve, reject or suspend an application.
   *
   * The write is guarded on the status we read, so two admins working the
   * queue at once cannot both apply a transition — the loser is told to
   * reload rather than silently overwriting the winner's decision.
   */
  async review(
    actor: IUserDocument,
    id: string,
    { status, reason }: ReviewVendorInput,
  ): Promise<VendorDocument> {
    const vendor = await this.adminGetById(id);

    if (status === vendor.status) {
      throw ApiError.badRequest(
        `This shop is already ${vendor.status.toLowerCase()}`,
      );
    }

    if (!VendorService.ALLOWED_TRANSITIONS[vendor.status].includes(status)) {
      throw ApiError.conflict(
        `Cannot move a shop from ${vendor.status.toLowerCase()} to ${status.toLowerCase()}`,
      );
    }

    const set: Record<string, unknown> = {
      status,
      reviewedAt: new Date(),
      reviewedBy: actor._id,
      // Only the reason belonging to the new state survives, so a shop that
      // was rejected and later approved doesn't keep showing the old note.
      rejectionReason: status === "REJECTED" ? (reason ?? null) : null,
      suspensionReason: status === "SUSPENDED" ? (reason ?? null) : null,
    };

    const updated = await Vendor.findOneAndUpdate(
      { _id: vendor._id, status: vendor.status },
      { $set: set },
      { returnDocument: "after", runValidators: true },
    );

    if (!updated) {
      throw ApiError.conflict(
        "This shop changed while you were reviewing it — reload and try again",
      );
    }

    if (status === SELLABLE_STATUS) {
      await VendorService.promoteOwner(updated.owner);
    }

    return updated;
  }

  /** A negotiated rate, or `null` to hand the shop back to the default. */
  async updateCommissionRate(
    id: string,
    { commissionRate }: UpdateCommissionInput,
  ): Promise<VendorDocument> {
    const vendor = await this.adminGetById(id);

    vendor.commissionRate = commissionRate;
    return vendor.save();
  }

  /**
   * Renaming is admin-only *and* re-slugs the shop.
   *
   * Customers have the old storefront URL bookmarked and linked, so this is
   * a deliberate, auditable action rather than something a vendor can do to
   * itself from a settings form.
   */
  async rename(
    id: string,
    { name }: RenameVendorInput,
  ): Promise<VendorDocument> {
    const vendor = await this.adminGetById(id);

    vendor.name = name;
    vendor.slug = await VendorService.uniqueSlug(name, vendor._id);
    return vendor.save();
  }

  // ---------- Cross-module helpers ----------

  /**
   * Keeps `productCount` honest as the products module creates and
   * soft-deletes. Best-effort: a wrong counter is a cosmetic problem on a
   * storefront header, never a reason to fail the write that caused it.
   */
  static async adjustProductCount(
    vendorId: Types.ObjectId,
    delta: number,
  ): Promise<void> {
    try {
      await Vendor.updateOne(
        { _id: vendorId },
        { $inc: { productCount: delta } },
      );
    } catch (error) {
      console.error(
        `Failed to adjust productCount for vendor ${vendorId.toString()} by ${String(delta)}`,
        error,
      );
    }
  }

  /** Whether this user may act on any shop, not just their own. */
  static isPrivileged(user: IUserDocument): boolean {
    return VendorService.PRIVILEGED_ROLES.includes(user.role);
  }

  // ---------- Internals ----------

  private static toObjectId(id: string, message: string): Types.ObjectId {
    // The routes validate this, but an unvalidated caller would otherwise
    // get a Mongoose CastError rendered as a 500 instead of a clean 404.
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound(message);
    }
    return new Types.ObjectId(id);
  }

  private static blockedMessage(vendor: VendorDocument): string {
    switch (vendor.status) {
      case "PENDING":
        return "Your seller application is still under review.";
      case "REJECTED":
        return vendor.rejectionReason
          ? `Your seller application was rejected: ${vendor.rejectionReason}`
          : "Your seller application was rejected.";
      case "SUSPENDED":
        return vendor.suspensionReason
          ? `Your shop is suspended: ${vendor.suspensionReason}`
          : "Your shop is suspended. Contact support.";
      default:
        return "Your shop cannot sell right now.";
    }
  }

  /**
   * Grants the seller role on approval.
   *
   * Scoped to `role: "USER"` so it only ever promotes: an ADMIN who also
   * runs a shop must not be silently demoted to MERCHANT by being approved.
   */
  private static async promoteOwner(ownerId: Types.ObjectId): Promise<void> {
    try {
      await User.updateOne(
        { _id: ownerId, role: "USER" },
        { $set: { role: "MERCHANT" } },
      );
    } catch (error) {
      // The shop is approved either way; the role is a convenience for the
      // UI, and `requireSellingVendor` is what actually gates selling.
      console.error(
        `Approved vendor owned by ${ownerId.toString()} but failed to grant the MERCHANT role`,
        error,
      );
    }
  }

  private static buildFilter(
    query: ListVendorsQuery & { status?: VendorStatus | undefined },
  ): QueryFilter<IVendor> {
    const filter: QueryFilter<IVendor> = { ...NOT_DELETED };

    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      filter.name = new RegExp(escapeRegex(query.search), "i");
    }

    return filter;
  }

  private static async page(
    filter: QueryFilter<IVendor>,
    { page, limit, sort }: ListVendorsQuery,
    select?: string,
  ): Promise<VendorPage> {
    const query = Vendor.find(filter)
      .sort(VendorService.SORT_STAGES[sort])
      .skip((page - 1) * limit)
      .limit(limit);

    if (select) {
      query.select(select);
    }

    const [data, total] = await Promise.all([
      query.exec(),
      Vendor.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  /**
   * Inserts the shop, regenerating the slug if it collides.
   *
   * The retry is keyed on *which* index tripped: a collision on `owner`
   * means this account already has a shop, and no amount of new slugs will
   * fix that — retrying it would burn five round trips and then report the
   * wrong error.
   */
  private static async insertWithSlug(
    data: Omit<
      IVendor,
      | "slug"
      | "status"
      | "commissionRate"
      | "reviewedAt"
      | "reviewedBy"
      | "rejectionReason"
      | "suspensionReason"
      | "productCount"
      | "ratingAverage"
      | "ratingCount"
      | "deletedAt"
      | "createdAt"
      | "updatedAt"
    >,
  ): Promise<VendorDocument> {
    const base = slugify(data.name) || "shop";

    for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt++) {
      try {
        return await Vendor.create({
          ...data,
          slug: attempt === 1 ? base : `${base}-${VendorService.suffix()}`,
        });
      } catch (error) {
        const field = duplicateKeyField(error);

        if (field === "owner") {
          throw ApiError.conflict(
            "You already have a shop on this marketplace",
          );
        }
        if (field !== "slug" || attempt === SLUG_ATTEMPTS) {
          throw error;
        }
      }
    }

    // Unreachable: the loop either returns or rethrows on its last pass.
    throw ApiError.conflict("Could not allocate a shop URL — try another name");
  }

  /** Finds a free slug for a rename, ignoring the shop being renamed. */
  private static async uniqueSlug(
    name: string,
    exclude: Types.ObjectId,
  ): Promise<string> {
    const base = slugify(name) || "shop";

    for (let attempt = 1; attempt <= SLUG_ATTEMPTS; attempt++) {
      const slug = attempt === 1 ? base : `${base}-${VendorService.suffix()}`;
      const taken = await Vendor.exists({ slug, _id: { $ne: exclude } });
      if (!taken) return slug;
    }

    throw ApiError.conflict("Could not allocate a shop URL — try another name");
  }

  /** Four random lowercase-alphanumeric characters. */
  private static suffix(): string {
    return randomBytes(4)
      .toString("base64url")
      .replace(/[^a-z0-9]/gi, "")
      .toLowerCase()
      .slice(0, 4)
      .padEnd(4, "0");
  }
}

export const vendorService = new VendorService();
