import mongoose, { Types, type PipelineStage } from "mongoose";
import {
  Product,
  type IProduct,
  type ProductDocument,
} from "./product.model.js";

/** Fields the caller supplies on insert; the rest are schema defaults. */
export type CreateProductData = Pick<
  IProduct,
  | "owner"
  | "vendor"
  | "categoryId"
  | "name"
  | "description"
  | "brand"
  | "images"
  | "price"
  | "stock"
  | "tags"
  | "isFeatured"
>;

/**
 * Ownership is never transferable through an update — neither to another
 * user nor, more importantly, to another shop: moving a listing between
 * vendors would re-point every past order line's commission at a business
 * that never made the sale.
 */
export type UpdateProductData = {
  [K in keyof Omit<CreateProductData, "owner" | "vendor">]?: CreateProductData[K];
};

export type SortStage = Record<string, 1 | -1>;

export interface PageRequest {
  page: number;
  limit: number;
}

/**
 * Every read here is scoped to non-deleted documents, so soft-deleted
 * products cannot leak out through a caller that forgot the filter.
 */
export class ProductRepository {
  protected readonly model = Product;

  private static readonly NOT_DELETED = { deletedAt: null } as const;

  create(data: CreateProductData) {
    return this.model.create(data);
  }

  /** Populated — for responses. */
  findById(id: string) {
    return (
      this.model
        .findOne({ _id: id, ...ProductRepository.NOT_DELETED })
        .populate("categoryId", "name slug")
        // Only the storefront-safe fields: a product page must not leak the
        // shop's payout account or negotiated commission rate.
        .populate("vendor", "name slug logoUrl ratingAverage ratingCount")
        .populate("owner", "firstName lastName avatarUrl")
    );
  }

  /** Unpopulated hydrated doc — for ownership checks and mutation. */
  findByIdRaw(id: string) {
    return this.model.findOne({ _id: id, ...ProductRepository.NOT_DELETED });
  }

  findAll(
    filter: mongoose.QueryFilter<IProduct>,
    sort: SortStage,
    page: PageRequest,
  ) {
    const stages: PipelineStage[] = [
      { $match: { ...filter, ...ProductRepository.NOT_DELETED } },
      { $sort: sort },
    ];
    return this.model.aggregatePaginate(this.model.aggregate(stages), page);
  }

  findByCategory(categoryId: string, page: PageRequest) {
    return this.findAll(
      { categoryId: new Types.ObjectId(categoryId) },
      { createdAt: -1 },
      page,
    );
  }

  /** A shop's own listings — the storefront, and the vendor's catalogue. */
  findByVendor(vendorId: Types.ObjectId, sort: SortStage, page: PageRequest) {
    return this.findAll({ vendor: vendorId }, sort, page);
  }

  updateById(id: string, data: UpdateProductData) {
    return this.model.findOneAndUpdate(
      { _id: id, ...ProductRepository.NOT_DELETED },
      { $set: data },
      { new: true, runValidators: true },
    );
  }

  softDeleteById(id: string) {
    return this.model.findOneAndUpdate(
      { _id: id, ...ProductRepository.NOT_DELETED },
      { $set: { deletedAt: new Date() } },
      { new: true },
    );
  }

  save(product: ProductDocument) {
    return product.save();
  }
}

export const productRepository = new ProductRepository();
