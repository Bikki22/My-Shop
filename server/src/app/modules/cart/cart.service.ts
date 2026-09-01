import { Types, type PipelineStage } from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import { Product, type ProductDocument } from "../products/product.model.js";
import type { IUserDocument } from "../users/user.model.js";
import { Cart, MAX_ITEM_QUANTITY } from "./cart.model.js";
import type { AddCartItemInput } from "./cart.validation.js";

/** MongoServerError code for a unique-index violation. */
const DUPLICATE_KEY = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === DUPLICATE_KEY;

/** One cart line, joined against the live product. */
export interface CartItemView {
  productId: Types.ObjectId;
  name: string | null;
  brand: string | null;
  image: string | null;
  categoryId: Types.ObjectId | null;
  price: number;
  stock: number;
  quantity: number;
  addedAt: Date;
  /** False once the product is deleted — kept in the cart, worth 0. */
  isAvailable: boolean;
  /** False when the requested quantity now exceeds stock. */
  inStock: boolean;
  lineTotal: number;
}

export interface CartSummary {
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  unavailableCount: number;
  /** True when at least one line is deleted or short on stock. */
  hasIssues: boolean;
}

export interface CartView {
  _id: Types.ObjectId | null;
  user: Types.ObjectId;
  items: CartItemView[];
  summary: CartSummary;
}

/** The badge in the header needs counts, not the whole joined cart. */
export interface CartCounts {
  itemCount: number;
  totalQuantity: number;
}

export class CartService {
  // ---------- Queries ----------

  /**
   * The cart as the client should see it: every line joined to its product,
   * priced and totalled.
   *
   * A cart document is *not* created on read — a user who has never added
   * anything gets the same empty shape as one whose cart was cleared.
   */
  async getMine(user: IUserDocument): Promise<CartView> {
    const [view] = await Cart.aggregate<CartView>(
      CartService.viewPipeline(user._id),
    );
    return view ?? CartService.emptyView(user._id);
  }

  async getCounts(user: IUserDocument): Promise<CartCounts> {
    const [counts] = await Cart.aggregate<CartCounts>(
      CartService.countsPipeline(user._id),
    );
    return counts ?? { itemCount: 0, totalQuantity: 0 };
  }

  // ---------- Commands ----------

  /**
   * Adds to the existing line if the product is already in the cart,
   * otherwise appends a new one.
   */
  async addItem(
    user: IUserDocument,
    { productId, quantity }: AddCartItemInput,
  ): Promise<CartView> {
    const product = await CartService.loadPurchasable(productId);
    const id = product._id;

    const currentQuantity = await this.quantityOf(user, id);
    const desired = currentQuantity + quantity;

    // `$inc` skips schema validators, so the cap and the stock ceiling have
    // to be enforced here rather than left to the model.
    CartService.assertWithinLimits(desired, product, currentQuantity);

    const incremented = await Cart.findOneAndUpdate(
      { user: user._id, "items.productId": id },
      { $inc: { "items.$.quantity": quantity } },
    );

    if (!incremented) {
      await this.pushItem(user, id, quantity);
    }

    return this.getMine(user);
  }

  /** Sets an existing line to an absolute quantity. */
  async setItemQuantity(
    user: IUserDocument,
    productId: string,
    quantity: number,
  ): Promise<CartView> {
    const product = await CartService.loadPurchasable(productId);

    CartService.assertWithinLimits(quantity, product, 0);

    // Only whether the line matched matters here, so the pre-update
    // document is enough — `new: true` is deprecated in Mongoose 9 anyway.
    const updated = await Cart.findOneAndUpdate(
      { user: user._id, "items.productId": product._id },
      { $set: { "items.$.quantity": quantity } },
      { runValidators: true },
    );

    if (!updated) {
      throw ApiError.notFound("That product is not in your cart");
    }

    return this.getMine(user);
  }

  /**
   * Removes a line. Deliberately does *not* load the product first: a
   * deleted product still has to be removable from the cart it is stuck in.
   */
  async removeItem(user: IUserDocument, productId: string): Promise<CartView> {
    if (!Types.ObjectId.isValid(productId)) {
      throw ApiError.notFound("That product is not in your cart");
    }

    const updated = await Cart.findOneAndUpdate(
      { user: user._id, "items.productId": new Types.ObjectId(productId) },
      { $pull: { items: { productId: new Types.ObjectId(productId) } } },
    );

    if (!updated) {
      throw ApiError.notFound("That product is not in your cart");
    }

    return this.getMine(user);
  }

  /** Empties the cart, keeping the document so the next add is one write. */
  async clear(user: IUserDocument): Promise<CartView> {
    await Cart.updateOne({ user: user._id }, { $set: { items: [] } });
    // Re-read rather than returning a synthesised empty view: the cart
    // document still exists, so this keeps the `_id` consistent with what
    // a following GET returns.
    return this.getMine(user);
  }

  // ---------- Internals ----------

  /** How many of `productId` this user already has, 0 if none. */
  private async quantityOf(
    user: IUserDocument,
    productId: Types.ObjectId,
  ): Promise<number> {
    const cart = await Cart.findOne(
      { user: user._id, "items.productId": productId },
      { "items.$": 1 },
    ).lean();

    return cart?.items[0]?.quantity ?? 0;
  }

  /**
   * Appends a line to the cart, creating the cart if this is the user's
   * first add.
   *
   * The `$ne` guard plus the retry is what makes this safe against two
   * concurrent adds of the same product: whichever request loses the race
   * no longer matches the filter, so its upsert tries to insert a *second*
   * cart for the user, trips the unique index on `user`, and is converted
   * back into an increment of the line the winner just created.
   */
  private async pushItem(
    user: IUserDocument,
    productId: Types.ObjectId,
    quantity: number,
  ): Promise<void> {
    const item = { productId, quantity, addedAt: new Date() };

    try {
      await Cart.findOneAndUpdate(
        { user: user._id, "items.productId": { $ne: productId } },
        { $push: { items: item } },
        { upsert: true, runValidators: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      await Cart.updateOne(
        { user: user._id, "items.productId": productId },
        { $inc: { "items.$.quantity": quantity } },
      );
    }
  }

  private static async loadPurchasable(
    productId: string,
  ): Promise<ProductDocument> {
    // The routes validate this, but an unvalidated caller would otherwise
    // get a Mongoose CastError rendered as a 500 instead of a clean 404.
    if (!Types.ObjectId.isValid(productId)) {
      throw ApiError.notFound("Product not found");
    }

    const product = await Product.findOne({ _id: productId, deletedAt: null });
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    return product;
  }

  /**
   * `already` is what the cart holds today, so the stock message can say
   * how many *more* the user may add rather than repeating the raw total.
   */
  private static assertWithinLimits(
    desired: number,
    product: ProductDocument,
    already: number,
  ): void {
    if (desired > MAX_ITEM_QUANTITY) {
      throw ApiError.badRequest(
        `You cannot have more than ${String(MAX_ITEM_QUANTITY)} of one product in your cart`,
      );
    }

    if (product.stock <= 0) {
      throw ApiError.conflict(`"${product.name}" is out of stock`);
    }

    if (desired > product.stock) {
      const remaining = product.stock - already;
      throw ApiError.conflict(
        remaining > 0
          ? `Only ${String(remaining)} more of "${product.name}" can be added (${String(product.stock)} in stock)`
          : `You already have all ${String(product.stock)} available of "${product.name}"`,
      );
    }
  }

  private static emptyView(userId: Types.ObjectId): CartView {
    return {
      _id: null,
      user: userId,
      items: [],
      summary: {
        itemCount: 0,
        totalQuantity: 0,
        subtotal: 0,
        unavailableCount: 0,
        hasIssues: false,
      },
    };
  }

  // ---------- Pipelines ----------

  /**
   * One round trip does the join, the pricing and the totals.
   *
   * Shape: unwind the lines, `$lookup` each product, fold the per-line
   * figures in, then `$group` back into a single cart document.
   *
   * `preserveNullAndEmptyArrays` appears twice for two different reasons:
   * on `items` so a cart with no lines still produces a document, and on
   * `product` so a line whose product was deleted survives the join as an
   * unavailable line instead of vanishing from the user's cart.
   */
  private static viewPipeline(userId: Types.ObjectId): PipelineStage[] {
    return [
      { $match: { user: userId } },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "products",
          let: { productId: "$items.productId" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$productId"] },
                deletedAt: null,
              },
            },
            // Project inside the lookup: the cart never needs the product's
            // description or tags, and this keeps them out of the pipeline's
            // working set entirely.
            {
              $project: {
                _id: 0,
                name: 1,
                brand: 1,
                price: 1,
                stock: 1,
                categoryId: 1,
                image: { $first: "$images" },
              },
            },
          ],
          as: "product",
        },
      },
      { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
      {
        // Null for the empty-cart row, so the `$group` below can push it and
        // the final `$filter` can drop it — `$group` cannot skip a document.
        $addFields: {
          line: {
            $cond: [
              { $ifNull: ["$items.productId", false] },
              {
                productId: "$items.productId",
                name: { $ifNull: ["$product.name", null] },
                brand: { $ifNull: ["$product.brand", null] },
                image: { $ifNull: ["$product.image", null] },
                categoryId: { $ifNull: ["$product.categoryId", null] },
                price: { $ifNull: ["$product.price", 0] },
                stock: { $ifNull: ["$product.stock", 0] },
                quantity: "$items.quantity",
                addedAt: "$items.addedAt",
                isAvailable: { $ne: [{ $type: "$product" }, "missing"] },
                inStock: {
                  $lte: ["$items.quantity", { $ifNull: ["$product.stock", 0] }],
                },
                lineTotal: {
                  $round: [
                    {
                      $multiply: [
                        { $ifNull: ["$product.price", 0] },
                        "$items.quantity",
                      ],
                    },
                    2,
                  ],
                },
              },
              null,
            ],
          },
        },
      },
      {
        $group: {
          _id: "$_id",
          user: { $first: "$user" },
          items: { $push: "$line" },
          // A deleted product prices at 0, so it cannot inflate the total.
          subtotal: { $sum: { $ifNull: ["$line.lineTotal", 0] } },
          totalQuantity: { $sum: { $ifNull: ["$line.quantity", 0] } },
          unavailableCount: {
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ["$line.isAvailable", true] }, false] },
                1,
                0,
              ],
            },
          },
          outOfStockCount: {
            $sum: {
              $cond: [
                { $eq: [{ $ifNull: ["$line.inStock", true] }, false] },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $set: {
          items: {
            $filter: {
              input: "$items",
              as: "item",
              cond: { $ne: ["$$item", null] },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          user: 1,
          items: 1,
          summary: {
            itemCount: { $size: "$items" },
            totalQuantity: "$totalQuantity",
            // Floating-point prices accumulate error over a long cart, so
            // the total is rounded once, at the end.
            subtotal: { $round: ["$subtotal", 2] },
            unavailableCount: "$unavailableCount",
            hasIssues: {
              $gt: [{ $add: ["$unavailableCount", "$outOfStockCount"] }, 0],
            },
          },
        },
      },
    ];
  }

  /**
   * Counts only — no `$lookup`, because a header badge does not need
   * prices and joining every product to render a number is pure waste.
   */
  private static countsPipeline(userId: Types.ObjectId): PipelineStage[] {
    return [
      { $match: { user: userId } },
      {
        $project: {
          _id: 0,
          itemCount: { $size: "$items" },
          totalQuantity: { $sum: "$items.quantity" },
        },
      },
    ];
  }
}

export const cartService = new CartService();
