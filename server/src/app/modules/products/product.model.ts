import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type Types,
} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

/**
 * The persisted shape only. It deliberately does not extend `Document` —
 * that is what `HydratedDocument` is for, and mixing the two makes
 * `Partial<IProduct>` include every mongoose method.
 */
export interface IProduct {
  /**
   * The *user* who owns the listing. Kept alongside `vendor` because every
   * permission check is "is this yours?", and answering that from the
   * product alone avoids a lookup on the shop for each write.
   */
  owner: Types.ObjectId;
  /**
   * The *shop* the listing belongs to. This is the grouping key for the
   * whole marketplace: storefronts, per-vendor order splitting, commission
   * and payouts all hang off it. Set from the owner's approved shop at
   * creation and never transferable afterwards.
   */
  vendor: Types.ObjectId;
  categoryId: Types.ObjectId;
  name: string;
  description: string;
  brand: string;
  images: string[];
  price: number;
  stock: number;
  tags: string[];
  isFeatured: boolean;
  ratingCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ProductDocument = HydratedDocument<IProduct>;

const productSchema = new Schema<IProduct>(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: [3, "Name must be at least 3 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (arr: string[]) => arr.length > 0,
        message: "At least one product image is required",
      },
    },
    price: {
      type: Number,
      required: true,
      min: [0, "Price cannot be negative"],
    },
    stock: {
      type: Number,
      required: true,
      min: [0, "Stock cannot be negative"],
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    ratingCount: {
      type: Number,
      default: 0,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// A storefront is always "this shop's live listings, newest first", so the
// vendor index carries the soft-delete filter and the sort with it rather
// than leaving Mongo to sort the whole matched set in memory.
productSchema.index({ vendor: 1, deletedAt: 1, createdAt: -1 });

productSchema.index({ name: "text", description: "text", tags: "text" });
productSchema.plugin(mongooseAggregatePaginate);

export const Product = model<
  IProduct,
  mongoose.AggregatePaginateModel<IProduct>
>("Product", productSchema);
