import { z } from "zod";

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id format");

const priceSchema = z.coerce.number().min(0, "Price cannot be negative");
const stockSchema = z.coerce.number().int().min(0, "Stock cannot be negative");

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const createProductBodySchema = z.object({
  categoryId: objectIdSchema,
  name: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters")
    .max(50, "Name cannot exceed 50 characters"),
  description: z
    .string()
    .trim()
    .min(10, "Description must be at least 10 characters"),
  brand: z.string().trim(),
  images: z
    .array(z.url("Each image must be a valid URL"))
    .min(1, "At least one product image is required"),
  price: priceSchema,
  stock: stockSchema.default(0),
  tags: z.array(z.string().trim()).optional().default([]),
  isFeatured: z.boolean().optional().default(false),
});

export const updateProductBodySchema = createProductBodySchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided to update",
  });

export const productIdParamSchema = z.object({
  id: objectIdSchema,
});

export const categoryIdParamSchema = z.object({
  categoryId: objectIdSchema,
});

export const getAllProductsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  tags: z.string().trim().optional(), // comma-separated, split in the service
  /** Narrow the catalogue to one shop — the marketplace's primary facet. */
  vendor: objectIdSchema.optional(),
  categoryId: objectIdSchema.optional(),
  sort: z
    .enum(["price_asc", "price_desc", "newest"])
    .optional()
    .default("newest"),
});

export const vendorSlugParamSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid shop slug"),
});

export const removeProductSubImageBodySchema = z.object({
  imageUrl: z.url("imageUrl must be a valid URL"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductBodySchema>;
export type UpdateProductInput = z.infer<typeof updateProductBodySchema>;
export type GetAllProductsQuery = z.infer<typeof getAllProductsQuerySchema>;
export type RemoveSubImageInput = z.infer<
  typeof removeProductSubImageBodySchema
>;
