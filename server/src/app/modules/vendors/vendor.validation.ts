import { z } from "zod";
import { PAGINATION, SEARCH_MAX_LENGTH } from "../../constants.js";
import { PAYOUT_METHODS, VENDOR_STATUSES } from "./vendor.model.js";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

/**
 * Deliberately permissive: phone formats vary by country and a strict
 * pattern rejects real applicants at the last step of a form.
 */
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+()\d][\d\s\-()]{6,19}$/, "Invalid phone number");

const shortText = (label: string, max = 100) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} cannot exceed ${String(max)} characters`);

const addressSchema = z
  .object({
    line1: shortText("Address line 1", 120),
    line2: z.string().trim().max(120).nullable().optional(),
    city: shortText("City", 60),
    state: shortText("State", 60),
    postalCode: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9][A-Za-z0-9\s-]{2,11}$/, "Invalid postal code"),
    country: shortText("Country", 60),
  })
  .strict();

/**
 * A payout account is validated as a discriminated union rather than a bag
 * of optional fields: "method: BANK with no account number" has to be a
 * 400 at application time, not a support ticket on the first payout run.
 */
const payoutAccountSchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("ESEWA"),
      esewaId: shortText("eSewa ID", 40),
    })
    .strict(),
  z
    .object({
      method: z.literal("BANK"),
      bankName: shortText("Bank name", 80),
      accountName: shortText("Account holder name", 80),
      accountNumber: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9-]{6,32}$/, "Invalid account number"),
    })
    .strict(),
]);

const kycDocumentSchema = z
  .object({
    label: shortText("Document label", 60),
    url: z.url("Document must be a valid URL"),
  })
  .strict();

/**
 * `.strict()` throughout, and note what is absent: `status`, `slug`,
 * `commissionRate`, and every counter. Those are platform-owned — a vendor
 * that could post its own `status: "APPROVED"` or `commissionRate: 0`
 * would be approving itself and selling for free.
 */
export const applyVendorBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Shop name must be at least 2 characters")
      .max(60, "Shop name cannot exceed 60 characters"),
    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .optional()
      .default(""),
    logoUrl: z.url("Logo must be a valid URL").nullable().optional(),
    bannerUrl: z.url("Banner must be a valid URL").nullable().optional(),
    email: z.email("Invalid email address"),
    phone: phoneSchema,
    address: addressSchema,
    payoutAccount: payoutAccountSchema,
    documents: z.array(kycDocumentSchema).max(10).optional().default([]),
  })
  .strict();

/**
 * Self-service edits to an existing shop. `name` is absent on purpose:
 * the slug is derived from it and a storefront URL that changes under
 * customers' feet breaks every link and bookmark pointing at the shop.
 * Renaming is an admin action.
 */
export const updateMyVendorBodySchema = z
  .object({
    description: z
      .string()
      .trim()
      .max(1000, "Description cannot exceed 1000 characters")
      .optional(),
    logoUrl: z.url("Logo must be a valid URL").nullable().optional(),
    bannerUrl: z.url("Banner must be a valid URL").nullable().optional(),
    email: z.email("Invalid email address").optional(),
    phone: phoneSchema.optional(),
    address: addressSchema.optional(),
    payoutAccount: payoutAccountSchema.optional(),
    documents: z.array(kycDocumentSchema).max(10).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export const vendorIdParamSchema = z.object({ id: objectIdSchema });

export const vendorSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid shop slug"),
});

const paginationQuerySchema = z.object({
  page: z.coerce
    .number()
    .int()
    .min(1)
    .optional()
    .default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_LIMIT)
    .optional()
    .default(PAGINATION.DEFAULT_LIMIT),
});

const vendorSortSchema = z
  .enum(["newest", "oldest", "name_asc", "rating_desc"])
  .optional()
  .default("newest");

/** The public shop directory. Status is not a filter here — see the service. */
export const listVendorsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(SEARCH_MAX_LENGTH).optional(),
  sort: vendorSortSchema,
});

/** The admin queue, which *can* see every status. */
export const listVendorsAdminQuerySchema = listVendorsQuerySchema.extend({
  status: z.enum(VENDOR_STATUSES).optional(),
});

export const reviewVendorBodySchema = z
  .object({
    /**
     * Only the outcomes an admin can *choose*. `PENDING` is absent: an
     * application returns to pending by being re-submitted by its owner,
     * never by an admin pushing it back.
     */
    status: z.enum(["APPROVED", "REJECTED", "SUSPENDED"]),
    reason: z
      .string()
      .trim()
      .max(300, "Reason cannot exceed 300 characters")
      .optional(),
  })
  .strict()
  .refine((data) => data.status === "APPROVED" || Boolean(data.reason), {
    message: "A reason is required when rejecting or suspending a shop",
    path: ["reason"],
  });

export const updateCommissionBodySchema = z
  .object({
    /** `null` hands the vendor back to the platform default rate. */
    commissionRate: z
      .number()
      .min(0, "Commission rate cannot be negative")
      .max(1, "Commission rate cannot exceed 1 (100%)")
      .nullable(),
  })
  .strict();

export const renameVendorBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Shop name must be at least 2 characters")
      .max(60, "Shop name cannot exceed 60 characters"),
  })
  .strict();

export type ApplyVendorInput = z.infer<typeof applyVendorBodySchema>;
export type UpdateMyVendorInput = z.infer<typeof updateMyVendorBodySchema>;
export type ListVendorsQuery = z.infer<typeof listVendorsQuerySchema>;
export type ListVendorsAdminQuery = z.infer<typeof listVendorsAdminQuerySchema>;
export type ReviewVendorInput = z.infer<typeof reviewVendorBodySchema>;
export type UpdateCommissionInput = z.infer<typeof updateCommissionBodySchema>;
export type RenameVendorInput = z.infer<typeof renameVendorBodySchema>;
export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;
