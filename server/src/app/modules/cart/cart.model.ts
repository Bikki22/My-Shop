import mongoose, {
  model,
  Schema,
  type HydratedDocument,
  type Types,
} from "mongoose";

/**
 * Single source of truth for the per-line cap: the Mongoose schema and the
 * Zod body schema both read it, so the two can't drift apart.
 */
export const MAX_ITEM_QUANTITY = 99;

export interface ICartItem {
  productId: Types.ObjectId;
  quantity: number;
  addedAt: Date;
}

/**
 * The persisted shape only — deliberately not extending `Document`, for the
 * same reason as `IProduct`/`ICategory`.
 *
 * Note what is *absent*: no price, no name, no line total. A cart stores
 * intent (which product, how much) and nothing else; every money figure is
 * derived from the product at read time by the aggregation in the service.
 * Snapshotting the price here would quietly serve stale prices for as long
 * as a cart lives.
 */
export interface ICart {
  user: Types.ObjectId;
  items: ICartItem[];
  createdAt: Date;
  updatedAt: Date;
}

export type CartDocument = HydratedDocument<ICart>;

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: [1, "Quantity must be at least 1"],
      max: [MAX_ITEM_QUANTITY, `Quantity cannot exceed ${MAX_ITEM_QUANTITY}`],
    },

    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  // The productId identifies the line; a generated `_id` per subdocument
  // would just be noise the client has to carry around.
  { _id: false },
);

const cartSchema = new Schema<ICart>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      // One cart per user. This is also what makes the "upsert, then retry
      // on duplicate key" path in the service safe under concurrent adds —
      // `unique` already builds the index, so no `index: true` as well.
      unique: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  { timestamps: true },
);

export const Cart = model<ICart>("Cart", cartSchema);
