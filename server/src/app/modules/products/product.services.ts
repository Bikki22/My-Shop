import mongoose, { Types } from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import type { IUserDocument, UserRole } from "../users/user.model.js";
import type { IProduct, ProductDocument } from "./product.model.js";
import {
  productRepository,
  ProductRepository,
  type PageRequest,
  type SortStage,
  type UpdateProductData,
} from "./product.repository.js";
import type {
  CreateProductInput,
  GetAllProductsQuery,
  UpdateProductInput,
} from "./product.validation.js";

/** Drops keys explicitly set to `undefined` so they never reach `$set`. */
const omitUndefined = <T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };

export class ProductService {
  private static readonly PRIVILEGED_ROLES: readonly UserRole[] = [
    "ADMIN",
    "SUPER_ADMIN",
  ];

  private static readonly SORT_STAGES: Record<
    GetAllProductsQuery["sort"],
    SortStage
  > = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
  };

  constructor(private readonly repository: ProductRepository) {}

  // ---------- Queries ----------

  async getById(id: string): Promise<ProductDocument> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    return product;
  }

  getAll(query: GetAllProductsQuery) {
    const { page, limit, sort } = query;
    return this.repository.findAll(
      ProductService.buildFilter(query),
      ProductService.SORT_STAGES[sort],
      { page, limit },
    );
  }

  getByCategory(categoryId: string, page: PageRequest) {
    return this.repository.findByCategory(categoryId, page);
  }

  // ---------- Commands ----------

  create(input: CreateProductInput, owner: IUserDocument) {
    return this.repository.create({
      ...input,
      categoryId: new Types.ObjectId(input.categoryId),
      owner: owner._id,
    });
  }

  async update(id: string, input: UpdateProductInput, user: IUserDocument) {
    await this.loadManageable(id, user);
    return this.repository.updateById(id, ProductService.toUpdateData(input));
  }

  async remove(id: string, user: IUserDocument): Promise<void> {
    await this.loadManageable(id, user);
    await this.repository.softDeleteById(id);
  }

  async removeSubImage(id: string, imageUrl: string, user: IUserDocument) {
    const product = await this.loadManageable(id, user);

    if (!product.images.includes(imageUrl)) {
      throw ApiError.notFound("Image not found on this product");
    }
    if (product.images.length <= 1) {
      throw ApiError.badRequest("Product must have at least one image");
    }

    product.images = product.images.filter((image) => image !== imageUrl);
    return this.repository.save(product);
  }

  // ---------- Internals ----------

  /**
   * Loads a product and asserts the caller may mutate it.
   * Every write path goes through here, so the 404-then-403 ordering
   * (and the check itself) can't drift between them.
   */
  private async loadManageable(
    id: string,
    user: IUserDocument,
  ): Promise<ProductDocument> {
    const product = await this.repository.findByIdRaw(id);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    if (!ProductService.canManage(product, user)) {
      throw ApiError.forbidden("You don't own this product");
    }
    return product;
  }

  private static canManage(
    product: ProductDocument,
    user: IUserDocument,
  ): boolean {
    return (
      product.owner.equals(user._id) ||
      ProductService.PRIVILEGED_ROLES.includes(user.role)
    );
  }

  private static buildFilter(
    query: GetAllProductsQuery,
  ): mongoose.QueryFilter<IProduct> {
    const { search, minPrice, maxPrice, tags } = query;
    const filter: mongoose.QueryFilter<IProduct> = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {
        ...(minPrice !== undefined && { $gte: minPrice }),
        ...(maxPrice !== undefined && { $lte: maxPrice }),
      };
    }

    if (tags) {
      const values = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (values.length > 0) {
        filter.tags = { $in: values };
      }
    }

    return filter;
  }

  /** Maps validated input onto persistence types (ids become ObjectIds). */
  private static toUpdateData(input: UpdateProductInput): UpdateProductData {
    const { categoryId, ...rest } = input;
    const data: UpdateProductData = omitUndefined(rest);

    if (categoryId) {
      data.categoryId = new Types.ObjectId(categoryId);
    }

    return data;
  }
}

export const productService = new ProductService(productRepository);
