import { z } from "zod";
import { MAX_ITEM_QUANTITY } from "./cart.model.js";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

const quantitySchema = z.coerce
  .number()
  .int("Quantity must be a whole number")
  .min(1, "Quantity must be at least 1")
  .max(MAX_ITEM_QUANTITY, `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`);

/**
 * `.strict()` throughout: a cart line is derived data apart from these two
 * fields, so an attempt to post a `price` is a 400 rather than a silently
 * ignored field that a caller might believe was honoured.
 */
export const addCartItemBodySchema = z
  .object({
    productId: objectIdSchema,
    quantity: quantitySchema.optional().default(1),
  })
  .strict();

export const updateCartItemBodySchema = z
  .object({
    quantity: quantitySchema,
  })
  .strict();

export const cartItemParamSchema = z.object({
  productId: objectIdSchema,
});

export type AddCartItemInput = z.infer<typeof addCartItemBodySchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemBodySchema>;
