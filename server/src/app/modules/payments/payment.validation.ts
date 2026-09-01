import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

/**
 * eSewa echoes our `transaction_uuid` back, and it lands in a database
 * filter — so it is constrained to the alphabet eSewa itself allows
 * (alphanumeric and hyphen) rather than trusted as free text.
 */
export const transactionUuidSchema = z
  .string()
  .trim()
  .min(6)
  .max(60)
  .regex(/^[A-Za-z0-9-]+$/, "Invalid transaction reference");

export const initiatePaymentBodySchema = z
  .object({
    orderId: objectIdSchema,
  })
  .strict();

/**
 * The redirect carries a single base64 blob. Its *contents* are validated
 * separately (`esewaCallbackPayloadSchema`) after decoding, because a
 * malformed blob and a well-formed blob with a bad signature are different
 * failures and deserve different answers.
 */
export const esewaCallbackQuerySchema = z.object({
  data: z.string().min(1, "Missing eSewa payload").max(4096),
});

/**
 * eSewa sends every field as a string, including the amount. It is kept as
 * a string all the way through signature verification — re-formatting it
 * to a number first would change the bytes the signature covers.
 */
export const esewaCallbackPayloadSchema = z.object({
  transaction_code: z.string(),
  status: z.string(),
  total_amount: z.string(),
  transaction_uuid: transactionUuidSchema,
  product_code: z.string(),
  signed_field_names: z.string(),
  signature: z.string(),
});

/**
 * The failure redirect is not signed by eSewa, so it is treated as a hint
 * only: the handler still asks the status API what really happened.
 */
export const esewaFailureQuerySchema = z.object({
  data: z.string().max(4096).optional(),
  transaction_uuid: transactionUuidSchema.optional(),
});

export const transactionUuidParamSchema = z.object({
  transactionUuid: transactionUuidSchema,
});

export const orderIdParamSchema = z.object({
  orderId: objectIdSchema,
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentBodySchema>;
export type EsewaCallbackQuery = z.infer<typeof esewaCallbackQuerySchema>;
export type EsewaFailureQuery = z.infer<typeof esewaFailureQuerySchema>;
