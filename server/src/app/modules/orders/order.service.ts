import { randomBytes } from "node:crypto";
import { Types, type QueryFilter } from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import { Cart } from "../cart/cart.model.js";
import { cartService, type CartItemView } from "../cart/cart.service.js";
import { Product } from "../products/product.model.js";
import type { IUserDocument, UserRole } from "../users/user.model.js";
import {
  MAX_ORDER_ITEMS,
  Order,
  type IOrder,
  type IOrderItem,
  type IOrderPricing,
  type IOrderStatusEvent,
  type OrderDocument,
  type OrderStatus,
  type PaymentStatus,
} from "./order.model.js";
import type {
  CreateOrderInput,
  ListMyOrdersQuery,
  ListOrdersQuery,
  UpdateOrderStatusInput,
} from "./order.validation.js";

/** MongoServerError code for a unique-index violation. */
const DUPLICATE_KEY = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === DUPLICATE_KEY;

/**
 * Money is stored as a plain number, so every derived figure is rounded to
 * cents at the point it is computed — otherwise `0.1 + 0.2` style error
 * accumulates across lines and the total the customer agreed to no longer
 * matches the sum of what they see.
 */
const money = (value: number): number => Math.round(value * 100) / 100;

/**
 * The shop's charging policy, in one place.
 *
 * These are placeholders for a real pricing service (or a settings
 * collection); they live here so there is exactly one thing to change when
 * the real numbers arrive, rather than a literal buried in the checkout.
 */
export const PRICING_POLICY = {
  /** Flat rate, waived once the order is big enough. */
  shippingFee: 49,
  freeShippingThreshold: 999,
  /** Fraction of the subtotal, e.g. 0.13 for 13%. */
  taxRate: 0,
} as const;

/** How many times a collided random order number is regenerated. */
const ORDER_NUMBER_ATTEMPTS = 5;

/** What has to go back on the shelf if a checkout unwinds. */
interface StockLine {
  productId: Types.ObjectId;
  quantity: number;
  name: string;
}

export interface OrderPage {
  data: OrderDocument[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export class OrderService {
  private static readonly PRIVILEGED_ROLES: readonly UserRole[] = [
    "ADMIN",
    "SUPER_ADMIN",
  ];

  /**
   * The state machine, spelled out. Everything not listed is refused, so a
   * new status can never accidentally become reachable from everywhere —
   * `DELIVERED` and `CANCELLED` are terminal by having no successors.
   */
  private static readonly ALLOWED_TRANSITIONS: Record<
    OrderStatus,
    readonly OrderStatus[]
  > = {
    PENDING: ["CONFIRMED", "PROCESSING", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED"],
    DELIVERED: [],
    CANCELLED: [],
  };

  /** Past this point the parcel is with the courier — support handles it. */
  private static readonly CUSTOMER_CANCELLABLE: readonly OrderStatus[] = [
    "PENDING",
    "CONFIRMED",
    "PROCESSING",
  ];

  private static readonly PAYMENT_TRANSITIONS: Record<
    PaymentStatus,
    readonly PaymentStatus[]
  > = {
    PENDING: ["PAID", "FAILED"],
    PAID: ["REFUNDED"],
    FAILED: ["PENDING", "PAID"],
    REFUNDED: [],
  };

  private static readonly SORT_STAGES: Record<
    ListOrdersQuery["sort"],
    Record<string, 1 | -1>
  > = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    total_desc: { "pricing.grandTotal": -1 },
    total_asc: { "pricing.grandTotal": 1 },
  };

  // ---------- Queries ----------

  /** The signed-in customer's own orders. */
  listMine(user: IUserDocument, query: ListMyOrdersQuery): Promise<OrderPage> {
    const filter: QueryFilter<IOrder> = { user: user._id };
    if (query.status) {
      filter.status = query.status;
    }
    return OrderService.page(filter, query);
  }

  /** Admin queue: every order, narrowed by the listing filters. */
  list(query: ListOrdersQuery): Promise<OrderPage> {
    return OrderService.page(OrderService.buildFilter(query), query);
  }

  /**
   * One order, readable by the customer who placed it or by an admin.
   * The ownership check lives here rather than in the route so both the
   * id and the order-number lookups get it.
   */
  async getForUser(id: string, user: IUserDocument): Promise<OrderDocument> {
    const order = await OrderService.loadById(id);
    OrderService.assertReadable(order, user);
    return order;
  }

  async getByNumber(
    orderNumber: string,
    user: IUserDocument,
  ): Promise<OrderDocument> {
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      throw ApiError.notFound("Order not found");
    }
    OrderService.assertReadable(order, user);
    return order;
  }

  // ---------- Commands ----------

  /**
   * Turns the caller's cart into an order.
   *
   * The sequence matters, and it is the only interesting thing in this
   * module:
   *
   *   1. price the cart (server-side — the client sends no money figures),
   *   2. decrement stock line by line, each guarded by `stock >= quantity`,
   *   3. insert the order,
   *   4. drop the ordered lines from the cart.
   *
   * Steps 2–4 are not a transaction: this project targets a plain MongoDB
   * deployment, and `session`-based transactions need a replica set. So a
   * failure part-way through step 2 or 3 *compensates* instead — every
   * reservation already taken is put back before the error is rethrown.
   * The reservation itself is what keeps two customers from buying the
   * same last unit: the conditional `$inc` is atomic per product, so the
   * loser's update matches nothing and is reported as a 409 rather than
   * silently overselling.
   *
   * Step 4 is deliberately *not* compensated: once the order exists the
   * checkout succeeded, and a cart that failed to clear is a cosmetic
   * problem, not a reason to fail (or unwind) a placed order.
   */
  async checkout(
    user: IUserDocument,
    input: CreateOrderInput,
  ): Promise<OrderDocument> {
    const cart = await cartService.getMine(user);

    if (cart.items.length === 0) {
      throw ApiError.badRequest("Your cart is empty");
    }
    if (cart.items.length > MAX_ORDER_ITEMS) {
      throw ApiError.badRequest(
        `An order cannot contain more than ${String(MAX_ORDER_ITEMS)} different products`,
      );
    }

    OrderService.assertPurchasable(cart.items);

    const items = cart.items.map(OrderService.toOrderItem);
    const pricing = OrderService.price(items);

    await OrderService.reserveStock(items);

    let order: OrderDocument;
    try {
      order = await OrderService.insert({
        user: user._id,
        items,
        pricing,
        paymentMethod: input.paymentMethod,
        shippingAddress: {
          ...input.shippingAddress,
          // The Zod schema leaves `line2` absent; the model wants an
          // explicit null so the stored address shape is uniform.
          line2: input.shippingAddress.line2 ?? null,
        },
        ...(input.notes !== undefined && { notes: input.notes }),
        statusHistory: [
          { status: "PENDING", at: new Date(), note: "Order placed", by: null },
        ],
      });
    } catch (error) {
      await OrderService.releaseStock(items);
      throw error;
    }

    await OrderService.clearOrderedLines(user, items);

    return order;
  }

  /**
   * Customer-initiated cancellation, allowed only while the order has not
   * shipped.
   */
  async cancelMine(
    user: IUserDocument,
    id: string,
    reason?: string,
  ): Promise<OrderDocument> {
    const order = await OrderService.loadById(id);
    OrderService.assertReadable(order, user);

    if (!OrderService.CUSTOMER_CANCELLABLE.includes(order.status)) {
      throw ApiError.conflict(
        `An order that is already ${order.status.toLowerCase()} cannot be cancelled — contact support instead`,
      );
    }

    return OrderService.applyCancellation(order, reason ?? null, user._id);
  }

  /**
   * Admin-driven transition through the fulfilment states.
   *
   * The write is guarded on the status we read, so two admins clicking at
   * once cannot both apply a transition (and, for a cancellation, cannot
   * both restock).
   */
  async updateStatus(
    id: string,
    input: UpdateOrderStatusInput,
    actor: IUserDocument,
  ): Promise<OrderDocument> {
    const order = await OrderService.loadById(id);
    const next = input.status;
    const note = input.note ?? null;

    if (next === order.status) {
      throw ApiError.badRequest(
        `Order is already ${order.status.toLowerCase()}`,
      );
    }

    if (!OrderService.ALLOWED_TRANSITIONS[order.status].includes(next)) {
      throw ApiError.conflict(
        `Cannot move an order from ${order.status.toLowerCase()} to ${next.toLowerCase()}`,
      );
    }

    if (next === "CANCELLED") {
      return OrderService.applyCancellation(order, note, actor._id);
    }

    const set: Record<string, unknown> = { status: next };

    if (next === "DELIVERED") {
      set["deliveredAt"] = new Date();
      // Cash on delivery is settled by the courier handing the parcel
      // over, so delivery *is* the payment event for those orders.
      if (order.paymentMethod === "COD" && order.paymentStatus === "PENDING") {
        set["paymentStatus"] = "PAID";
      }
    }

    return OrderService.transition(order, set, {
      status: next,
      at: new Date(),
      note,
      by: actor._id,
    });
  }

  /**
   * Payment state moves independently of fulfilment (a card can settle
   * while the parcel is still being packed), so it has its own small
   * machine rather than being folded into `updateStatus`.
   */
  async updatePaymentStatus(
    id: string,
    paymentStatus: PaymentStatus,
    note: string | null,
    actor: IUserDocument,
  ): Promise<OrderDocument> {
    const order = await OrderService.loadById(id);

    if (paymentStatus === order.paymentStatus) {
      throw ApiError.badRequest(
        `Payment is already ${order.paymentStatus.toLowerCase()}`,
      );
    }

    if (
      !OrderService.PAYMENT_TRANSITIONS[order.paymentStatus].includes(
        paymentStatus,
      )
    ) {
      throw ApiError.conflict(
        `Cannot move payment from ${order.paymentStatus.toLowerCase()} to ${paymentStatus.toLowerCase()}`,
      );
    }

    const updated = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: order.paymentStatus },
      {
        $set: { paymentStatus },
        $push: {
          statusHistory: {
            status: order.status,
            at: new Date(),
            note: note ?? `Payment marked ${paymentStatus.toLowerCase()}`,
            by: actor._id,
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );

    if (!updated) {
      throw ApiError.conflict(
        "This order changed while you were updating it — reload and try again",
      );
    }

    return updated;
  }

  /**
   * The payment gateway's verdict, applied by the payment module.
   *
   * Unlike `updatePaymentStatus` this is **idempotent rather than strict**,
   * because the caller is a redirect a customer can replay by refreshing
   * the tab, and eSewa's own status API is polled on top of that. An
   * outcome the order has already recorded is a no-op, not a 409 — a
   * paid order must not start returning errors because the customer
   * pressed back.
   *
   * `by` is null throughout: nobody clicked this, a gateway said it.
   */
  async applyPaymentOutcome(
    orderId: Types.ObjectId,
    outcome: Extract<PaymentStatus, "PAID" | "FAILED" | "REFUNDED">,
    note: string,
  ): Promise<OrderDocument> {
    const order = await OrderService.loadById(orderId.toString());

    if (order.paymentStatus === outcome) return order;

    if (!OrderService.PAYMENT_TRANSITIONS[order.paymentStatus].includes(outcome)) {
      throw ApiError.conflict(
        `Cannot move payment from ${order.paymentStatus.toLowerCase()} to ${outcome.toLowerCase()}`,
      );
    }

    const set: Record<string, unknown> = { paymentStatus: outcome };

    // A successful prepayment is also the confirmation of the order: an
    // order sitting at PENDING is waiting for exactly this.
    if (outcome === "PAID" && order.status === "PENDING") {
      set["status"] = "CONFIRMED";
    }

    const updated = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: order.paymentStatus },
      {
        $set: set,
        $push: {
          statusHistory: {
            status: (set["status"] as OrderStatus | undefined) ?? order.status,
            at: new Date(),
            note,
            by: null,
          },
        },
      },
      { returnDocument: "after", runValidators: true },
    );

    // Lost the race to a concurrent callback for the same payment; that
    // caller applied the identical outcome, so re-read and report success.
    return updated ?? (await OrderService.loadById(order._id.toString()));
  }

  // ---------- Internals: reads ----------

  private static async loadById(id: string): Promise<OrderDocument> {
    // The routes validate this, but an unvalidated caller would otherwise
    // get a Mongoose CastError rendered as a 500 instead of a clean 404.
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound("Order not found");
    }

    const order = await Order.findById(id);
    if (!order) {
      throw ApiError.notFound("Order not found");
    }
    return order;
  }

  /**
   * A missing order and someone else's order answer identically on
   * purpose: a 403 here would confirm that an order with that id exists.
   */
  private static assertReadable(order: OrderDocument, user: IUserDocument) {
    if (order.user.equals(user._id)) return;
    if (OrderService.PRIVILEGED_ROLES.includes(user.role)) return;
    throw ApiError.notFound("Order not found");
  }

  private static async page(
    filter: QueryFilter<IOrder>,
    query: Pick<ListOrdersQuery, "page" | "limit" | "sort">,
  ): Promise<OrderPage> {
    const { page, limit, sort } = query;

    const [data, total] = await Promise.all([
      Order.find(filter)
        .sort(OrderService.SORT_STAGES[sort])
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  private static buildFilter(query: ListOrdersQuery): QueryFilter<IOrder> {
    const { status, paymentStatus, paymentMethod, user, orderNumber } = query;
    const { from, to } = query;

    const filter: QueryFilter<IOrder> = {};

    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (user) filter.user = new Types.ObjectId(user);

    if (orderNumber) {
      // Anchored and built from an escaped literal: the value reaches a
      // `$regex`, so an unescaped `.*` would widen the filter beyond what
      // the admin typed and `(((((a` would be a backtracking DoS.
      filter.orderNumber = new RegExp(
        `^${orderNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
        "i",
      );
    }

    if (from || to) {
      filter.placedAt = {
        ...(from && { $gte: from }),
        ...(to && { $lte: to }),
      };
    }

    return filter;
  }

  // ---------- Internals: checkout ----------

  /**
   * Rejects the whole checkout if any line is unbuyable, naming the lines
   * at fault — a customer who has to discover them one 409 at a time will
   * simply give up.
   */
  private static assertPurchasable(items: CartItemView[]): void {
    const unavailable = items.filter((item) => !item.isAvailable);
    if (unavailable.length > 0) {
      throw ApiError.conflict(
        `${String(unavailable.length)} item(s) in your cart are no longer sold. Remove them and try again.`,
      );
    }

    const short = items.filter((item) => !item.inStock);
    if (short.length > 0) {
      const detail = short
        .map(
          (item) =>
            `"${item.name ?? "Unknown product"}" (${String(item.stock)} left, ${String(item.quantity)} requested)`,
        )
        .join(", ");
      throw ApiError.conflict(`Not enough stock for ${detail}`);
    }
  }

  /** Cart line → frozen order line. */
  private static toOrderItem(item: CartItemView): IOrderItem {
    return {
      productId: item.productId,
      // `assertPurchasable` has already rejected unavailable lines, so the
      // product really is there; the fallbacks only satisfy the types.
      name: item.name ?? "Unknown product",
      brand: item.brand,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
      lineTotal: money(item.price * item.quantity),
    };
  }

  /** Charges are derived here and nowhere else. */
  private static price(items: IOrderItem[]): IOrderPricing {
    const subtotal = money(
      items.reduce((total, item) => total + item.lineTotal, 0),
    );

    const shippingFee =
      subtotal >= PRICING_POLICY.freeShippingThreshold
        ? 0
        : PRICING_POLICY.shippingFee;

    const taxTotal = money(subtotal * PRICING_POLICY.taxRate);
    const discountTotal = 0;

    return {
      subtotal,
      shippingFee,
      taxTotal,
      discountTotal,
      grandTotal: money(subtotal + shippingFee + taxTotal - discountTotal),
    };
  }

  /**
   * Takes the stock for every line, or takes none of it.
   *
   * `modifiedCount !== 1` covers both failure modes in one check: the
   * product was deleted between the cart read and here, or someone else
   * bought the units first (the `stock >= quantity` guard no longer
   * matches). Either way the reservations already made are released
   * before the error escapes.
   */
  private static async reserveStock(lines: StockLine[]): Promise<void> {
    const taken: StockLine[] = [];

    for (const line of lines) {
      const result = await Product.updateOne(
        {
          _id: line.productId,
          deletedAt: null,
          stock: { $gte: line.quantity },
        },
        { $inc: { stock: -line.quantity } },
      );

      if (result.modifiedCount !== 1) {
        await OrderService.releaseStock(taken);
        throw ApiError.conflict(
          `"${line.name}" just sold out or changed — please review your cart and try again`,
        );
      }

      taken.push(line);
    }
  }

  /**
   * Puts stock back — on a failed checkout, and on every cancellation.
   *
   * Best-effort by design: this runs while another error is already on its
   * way to the client, so a failure here must be logged rather than
   * thrown, or it would mask the real cause. A deleted product is skipped
   * (`deletedAt: null`) — restocking something that is no longer sold
   * would resurrect stock nobody can buy.
   */
  private static async releaseStock(lines: StockLine[]): Promise<void> {
    for (const line of lines) {
      try {
        await Product.updateOne(
          { _id: line.productId, deletedAt: null },
          { $inc: { stock: line.quantity } },
        );
      } catch (error) {
        console.error(
          `Failed to restock product ${line.productId.toString()} (${String(line.quantity)})`,
          error,
        );
      }
    }
  }

  /**
   * Inserts the order, regenerating the reference if the random suffix
   * collides with an existing one.
   */
  private static async insert(
    data: Omit<
      IOrder,
      | "orderNumber"
      | "status"
      | "paymentStatus"
      | "notes"
      | "placedAt"
      | "deliveredAt"
      | "cancelledAt"
      | "cancelReason"
      | "createdAt"
      | "updatedAt"
    > & { notes?: string },
  ): Promise<OrderDocument> {
    for (let attempt = 1; attempt <= ORDER_NUMBER_ATTEMPTS; attempt++) {
      try {
        return await Order.create({
          ...data,
          orderNumber: OrderService.nextOrderNumber(),
        });
      } catch (error) {
        if (!isDuplicateKeyError(error) || attempt === ORDER_NUMBER_ATTEMPTS) {
          throw error;
        }
      }
    }

    // Unreachable: the loop either returns or rethrows on its last pass.
    throw ApiError.conflict("Could not allocate an order number");
  }

  /**
   * `ORD-20260901-K3F9QZ` — sortable by eye, quotable over the phone.
   * The suffix is `crypto`-random rather than a counter: a sequence would
   * need its own document (another write, another race) and would leak the
   * shop's daily volume to anyone who placed two orders.
   */
  private static nextOrderNumber(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = randomBytes(5)
      .toString("base64url")
      .replace(/[^A-Za-z0-9]/g, "")
      .toUpperCase()
      .slice(0, 6)
      .padEnd(6, "0");

    return `ORD-${date}-${suffix}`;
  }

  /** Drops the just-ordered lines, leaving anything added mid-checkout. */
  private static async clearOrderedLines(
    user: IUserDocument,
    items: IOrderItem[],
  ): Promise<void> {
    try {
      await Cart.updateOne(
        { user: user._id },
        {
          $pull: {
            items: { productId: { $in: items.map((item) => item.productId) } },
          },
        },
      );
    } catch (error) {
      // The order is already placed; a stale cart is not worth a 500.
      console.error(
        `Failed to clear cart for user ${user._id.toString()}`,
        error,
      );
    }
  }

  // ---------- Internals: transitions ----------

  /** Guarded status write — the caller has already validated the move. */
  private static async transition(
    order: OrderDocument,
    set: Record<string, unknown>,
    event: IOrderStatusEvent,
  ): Promise<OrderDocument> {
    const updated = await Order.findOneAndUpdate(
      { _id: order._id, status: order.status },
      { $set: set, $push: { statusHistory: event } },
      { returnDocument: "after", runValidators: true },
    );

    if (!updated) {
      throw ApiError.conflict(
        "This order changed while you were updating it — reload and try again",
      );
    }

    return updated;
  }

  /**
   * Cancels and restocks, in that order.
   *
   * The status write goes first *because* it is guarded: only the caller
   * that actually moved the order out of its previous status restocks it,
   * so a double-click cannot return the units twice.
   */
  private static async applyCancellation(
    order: OrderDocument,
    reason: string | null,
    by: Types.ObjectId,
  ): Promise<OrderDocument> {
    const now = new Date();

    const set: Record<string, unknown> = {
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: reason,
    };

    // Money already taken has to go back; an unpaid order just stops.
    if (order.paymentStatus === "PAID") {
      set["paymentStatus"] = "REFUNDED";
    }

    const cancelled = await OrderService.transition(order, set, {
      status: "CANCELLED",
      at: now,
      note: reason,
      by,
    });

    await OrderService.releaseStock(cancelled.items);

    return cancelled;
  }
}

export const orderService = new OrderService();
