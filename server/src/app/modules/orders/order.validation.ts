import { z } from "zod";
import {
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from "./order.model.js";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

/**
 * Deliberately permissive: phone formats vary by country and a strict
 * pattern rejects real customers at the last step of a checkout. Digits,
 * spaces and the usual separators, 7–20 characters.
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

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const shippingAddressSchema = z
  .object({
    fullName: shortText("Full name", 80),
    phone: phoneSchema,
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
 * `.strict()` throughout: an order's items and every money figure are
 * derived server-side from the cart, so a body carrying `items`, `pricing`
 * or `status` is a 400 rather than a silently ignored field a caller might
 * believe was honoured. That is the difference between a client choosing
 * its own price and a client being told it cannot.
 */
export const createOrderBodySchema = z
  .object({
    shippingAddress: shippingAddressSchema,
    paymentMethod: z.enum(PAYMENT_METHODS),
    notes: z
      .string()
      .trim()
      .max(500, "Notes cannot exceed 500 characters")
      .optional(),
  })
  .strict();

export const updateOrderStatusBodySchema = z
  .object({
    status: z.enum(ORDER_STATUSES),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export const updatePaymentStatusBodySchema = z
  .object({
    paymentStatus: z.enum(PAYMENT_STATUSES),
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export const cancelOrderBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .max(200, "Reason cannot exceed 200 characters")
      .optional(),
  })
  .strict();

export const orderIdParamSchema = z.object({
  id: objectIdSchema,
});

export const orderNumberParamSchema = z.object({
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^ORD-\d{8}-[A-Z0-9]{6}$/, "Invalid order number"),
});

const orderSortSchema = z
  .enum(["newest", "oldest", "total_desc", "total_asc"])
  .optional()
  .default("newest");

export const listMyOrdersQuerySchema = paginationQuerySchema.extend({
  status: z.enum(ORDER_STATUSES).optional(),
  sort: orderSortSchema,
});

/**
 * `from`/`to` bound `placedAt`. They are plain dates rather than a free
 * text filter so the admin queue can be narrowed to a day, a week or a
 * quarter without the service having to parse anything itself.
 */
export const listOrdersQuerySchema = listMyOrdersQuerySchema.extend({
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  user: objectIdSchema.optional(),
  orderNumber: z.string().trim().min(3).max(30).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type ShippingAddressInput = z.infer<typeof shippingAddressSchema>;
export type CreateOrderInput = z.infer<typeof createOrderBodySchema>;
export type UpdateOrderStatusInput = z.infer<
  typeof updateOrderStatusBodySchema
>;
export type UpdatePaymentStatusInput = z.infer<
  typeof updatePaymentStatusBodySchema
>;
export type CancelOrderInput = z.infer<typeof cancelOrderBodySchema>;
export type ListMyOrdersQuery = z.infer<typeof listMyOrdersQuerySchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
