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

/** Ownership is never transferable through an update. */
export type UpdateProductData = {
  [K in keyof Omit<CreateProductData, "owner">]?: CreateProductData[K];
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
    return this.model
      .findOne({ _id: id, ...ProductRepository.NOT_DELETED })
      .populate("categoryId", "name slug")
      .populate("owner", "firstName lastName avatarUrl");
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
