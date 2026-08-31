import { z } from "zod";
import { USER_ROLES, USER_STATUSES } from "./user.model.js";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

const roleSchema = z.enum(USER_ROLES);
const statusSchema = z.enum(USER_STATUSES);

/**
 * Self-service profile edits. Role, status and email are deliberately
 * absent — those are admin- or Clerk-owned and must never be settable
 * from this route. `.strict()` turns an attempt to send them into a 400
 * instead of a silently ignored field.
 */
export const updateMeBodySchema = z
  .object({
    firstName: z
      .string()
      .trim()
      .min(1, "First name cannot be empty")
      .max(50, "First name cannot exceed 50 characters")
      .optional(),
    lastName: z
      .string()
      .trim()
      .max(50, "Last name cannot exceed 50 characters")
      .optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9\s-]{7,20}$/, "Invalid phone number")
      .nullable()
      .optional(),
    avatarUrl: z.url("Avatar must be a valid URL").nullable().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export const userIdParamSchema = z.object({
  id: objectIdSchema,
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  role: roleSchema.optional(),
  status: statusSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
});

export const updateUserRoleBodySchema = z.object({
  role: roleSchema,
});

export const updateUserStatusBodySchema = z.object({
  status: statusSchema,
});

export type UpdateMeInput = z.infer<typeof updateMeBodySchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleBodySchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusBodySchema>;
