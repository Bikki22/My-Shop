import { z } from "zod";
import { PAGINATION, SEARCH_MAX_LENGTH } from "../../constants.js";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

/**
 * `z.coerce.boolean()` is wrong for query strings — it follows JS
 * truthiness, so the string `"false"` coerces to `true`. Parse the two
 * literals instead.
 */
const booleanQuerySchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Slug must be at least 2 characters")
  .max(60, "Slug cannot exceed 60 characters")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may only contain lowercase letters, numbers and single hyphens",
  );

export const paginationQuerySchema = z.object({
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

/**
 * `slug` is optional on create: the service derives it from the name when
 * it is omitted, so callers only send one when they want a specific URL.
 */
export const createCategoryBodySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(50, "Name cannot exceed 50 characters"),
    slug: slugSchema.optional(),
    description: z
      .string()
      .trim()
      .max(500, "Description cannot exceed 500 characters")
      .optional()
      .default(""),
    image: z.url("Image must be a valid URL").nullable().optional(),
    isActive: z.boolean().optional().default(true),
  })
  .strict();

/**
 * `.strict()` so an attempt to set `owner` or `deletedAt` from the wire is
 * a 400 rather than a silently dropped field.
 */
export const updateCategoryBodySchema = createCategoryBodySchema
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export const categoryIdParamSchema = z.object({
  id: objectIdSchema,
});

export const categorySlugParamSchema = z.object({
  slug: slugSchema,
});

/**
 * `isActive` defaults to true so the public listing never leaks a hidden
 * category; pass `?isActive=false` to review the hidden ones.
 */
export const listCategoriesQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().min(1).max(SEARCH_MAX_LENGTH).optional(),
  isActive: booleanQuerySchema.optional().default(true),
  owner: objectIdSchema.optional(),
  sort: z
    .enum(["name_asc", "name_desc", "newest"])
    .optional()
    .default("name_asc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategoryBodySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
