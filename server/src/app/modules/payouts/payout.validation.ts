import { z } from "zod";
import { PAYOUT_STATUSES } from "./payout.model.js";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const payoutIdParamSchema = z.object({ id: objectIdSchema });

export const listMyPayoutsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(PAYOUT_STATUSES).optional(),
});

/** The admin queue can narrow to one shop; a vendor's own list cannot. */
export const listPayoutsQuerySchema = listMyPayoutsQuerySchema.extend({
  vendor: objectIdSchema.optional(),
});

/**
 * Starting a payout run for one shop.
 *
 * There is no amount here on purpose: what is owed is whatever the shop's
 * payable sub-orders add up to at the moment the run claims them. An amount
 * a client could send is an amount that disagrees with the ledger.
 */
export const createPayoutBodySchema = z
  .object({
    vendor: objectIdSchema,
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export const markPaidBodySchema = z
  .object({
    /** The bank's or eSewa's own transaction reference. */
    reference: z
      .string()
      .trim()
      .min(1, "A transfer reference is required")
      .max(100, "Reference cannot exceed 100 characters"),
    notes: z.string().trim().max(500).optional(),
  })
  .strict();

export const markFailedBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "A reason is required")
      .max(300, "Reason cannot exceed 300 characters"),
  })
  .strict();

export type ListMyPayoutsQuery = z.infer<typeof listMyPayoutsQuerySchema>;
export type ListPayoutsQuery = z.infer<typeof listPayoutsQuerySchema>;
export type CreatePayoutInput = z.infer<typeof createPayoutBodySchema>;
export type MarkPaidInput = z.infer<typeof markPaidBodySchema>;
export type MarkFailedInput = z.infer<typeof markFailedBodySchema>;
