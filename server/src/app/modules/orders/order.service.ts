import { randomBytes } from "node:crypto";
import { Types, type QueryFilter } from "mongoose";
import {
  commissionRateFor,
  PRICING_POLICY,
  shippingFeeFor,
} from "../../config/platform.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  sendOrderConfirmationEmail,
  sendPaymentReceivedEmail,
} from "../../utils/email.js";
import {
  isDuplicateKeyError,
  money,
  NOT_DELETED,
  prefixRegex,
} from "../../utils/mongo.js";
import { Cart } from "../cart/cart.model.js";
import { cartService, type CartItemView } from "../cart/cart.service.js";
import { Product } from "../products/product.model.js";
import {
  User,
  type IUserDocument,
  type UserRole,
} from "../users/user.model.js";
import {
  SELLABLE_STATUS,
  Vendor,
  type VendorDocument,
} from "../vendors/vendor.model.js";
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
import {
  SubOrder,
  type ISubOrder,
  type ISubOrderEarnings,
  type PayoutState,
  type SubOrderDocument,
} from "./sub-order.model.js";
import type {
  CreateOrderInput,
  ListMyOrdersQuery,
  ListOrdersQuery,
  ListSubOrdersQuery,
  UpdateSubOrderStatusInput,
} from "./order.validation.js";

/** How many times a collided order number is regenerated. */
const ORDER_NUMBER_ATTEMPTS = 5;

/** What has to go back on the shelf if a checkout unwinds. */
interface StockLine {
  productId: Types.ObjectId;
  quantity: number;
  name: string;
}

/** One shop's slice of the cart, priced and split. */
interface VendorSlice {
  vendor: VendorDocument;
  items: IOrderItem[];
  pricing: IOrderPricing;
  earnings: ISubOrderEarnings;
}

export interface OrderPage {
  data: OrderDocument[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface SubOrderPage {
  data: SubOrderDocument[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

/**
 * An order and its per-shop parts. Nothing useful can be said about an
 * order without them — the lines, the statuses and most of the money live
 * on the sub-orders — so every read that returns an order returns these.
 */
export interface OrderWithSubOrders {
  order: OrderDocument;
  subOrders: SubOrderDocument[];
}

export class OrderService {
  private static readonly PRIVILEGED_ROLES: readonly UserRole[] = [
    "ADMIN",
    "SUPER_ADMIN",
  ];

  /**
   * The fulfilment state machine, spelled out. Everything not listed is
   * refused, so a new status can never accidentally become reachable from
   * everywhere — `DELIVERED` and `CANCELLED` are terminal by having no
   * successors.
   *
   * It applies to a **sub-order**: fulfilment is per shop now, and a
   * customer's order is only as far along as its least-advanced part.
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

  /**
   * How far along each status is.
   *
   * This ordering is what `deriveStatus` reduces over: an order that is
   * half shipped and half still being packed is a *processing* order, not a
   * shipped one, because the customer has not received everything.
   * `CANCELLED` is absent — a cancelled part is excluded, not ranked.
   */
  private static readonly STATUS_RANK: Record<OrderStatus, number> = {
    PENDING: 0,
    CONFIRMED: 1,
    PROCESSING: 2,
    SHIPPED: 3,
    DELIVERED: 4,
    CANCELLED: 5,
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

  // ---------- Queries: customer ----------

  /** The signed-in customer's own orders. */
  listMine(user: IUserDocument, query: ListMyOrdersQuery): Promise<OrderPage> {
    const filter: QueryFilter<IOrder> = { user: user._id };
    if (query.status) {
      filter.status = query.status;
    }
    return OrderService.page(filter, query);
  }

  /**
   * One order with its parts, readable by the customer who placed it or by
   * an admin. The ownership check lives here rather than in the route so
   * both the id and the order-number lookups get it.
   */
  async getForUser(
    id: string,
    user: IUserDocument,
  ): Promise<OrderWithSubOrders> {
    return OrderService.withSubOrders(await this.getOrderForUser(id, user));
  }

  /**
   * The parent order alone, with the same ownership rule.
   *
   * For callers that genuinely only need the envelope — the payments
   * module works against the order's total and payment state, and loading
   * every sub-order to throw them away is a query for nothing.
   */
  async getOrderForUser(
    id: string,
    user: IUserDocument,
  ): Promise<OrderDocument> {
    const order = await OrderService.loadById(id);
    OrderService.assertReadable(order, user);
    return order;
  }

  async getByNumber(
    orderNumber: string,
    user: IUserDocument,
  ): Promise<OrderWithSubOrders> {
    const order = await Order.findOne({ orderNumber });
    if (!order) {
      throw ApiError.notFound("Order not found");
    }
    OrderService.assertReadable(order, user);
    return OrderService.withSubOrders(order);
  }

  // ---------- Queries: admin ----------

  /** Admin queue: every order, narrowed by the listing filters. */
  list(query: ListOrdersQuery): Promise<OrderPage> {
    return OrderService.page(OrderService.buildFilter(query), query);
  }

  /** The platform-wide fulfilment queue, across every shop. */
  listSubOrders(query: ListSubOrdersQuery): Promise<SubOrderPage> {
    return OrderService.pageSubOrders(
      OrderService.buildSubOrderFilter(query),
      query,
    );
  }

  // ---------- Queries: vendor ----------

  /**
   * The shop's own order queue.
   *
   * Scoped to the caller's vendor id rather than filtered by a `vendor`
   * query parameter: a filter a client supplies is a client choosing whose
   * orders to read.
   */
  async listForVendor(
    user: IUserDocument,
    query: ListSubOrdersQuery,
  ): Promise<SubOrderPage> {
    const vendor = await OrderService.vendorOf(user);

    return OrderService.pageSubOrders(
      { ...OrderService.buildSubOrderFilter(query), vendor: vendor._id },
      query,
    );
  }

  async getSubOrderForVendor(
    user: IUserDocument,
    subOrderId: string,
  ): Promise<SubOrderDocument> {
    const subOrder = await OrderService.loadSubOrder(subOrderId);
    await OrderService.assertSubOrderManageable(subOrder, user);
    return subOrder;
  }

  // ---------- Commands: checkout ----------

  /**
   * Turns the caller's cart into an order, split one sub-order per shop.
   *
   * The sequence matters, and it is the only interesting thing in this
   * module:
   *
   *   1. price the cart per shop (server-side — the client sends no money),
   *   2. decrement stock line by line, each guarded by `stock >= quantity`,
   *   3. insert the parent order,
   *   4. insert one sub-order per shop,
   *   5. drop the ordered lines from the cart.
   *
   * Steps 2–5 are not a transaction: this project targets a plain MongoDB
   * deployment, and `session`-based transactions need a replica set. So a
   * failure part-way through *compensates* instead — every reservation
   * already taken is put back, and a parent order whose sub-orders failed
   * to insert is deleted, before the error is rethrown. The reservation
   * itself is what keeps two customers from buying the same last unit: the
   * conditional `$inc` is atomic per product, so the loser's update matches
   * nothing and is reported as a 409 rather than silently overselling.
   *
   * Step 5 is deliberately *not* compensated: once the order exists the
   * checkout succeeded, and a cart that failed to clear is a cosmetic
   * problem, not a reason to fail (or unwind) a placed order.
   */
  async checkout(
    user: IUserDocument,
    input: CreateOrderInput,
  ): Promise<OrderWithSubOrders> {
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

    const slices = await OrderService.split(cart.items);
    const allItems = slices.flatMap((slice) => slice.items);
    const pricing = OrderService.combine(slices);

    await OrderService.reserveStock(allItems);

    let order: OrderDocument;
    try {
      order = await OrderService.insertOrder({
        user: user._id,
        vendorCount: slices.length,
        itemCount: allItems.length,
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
      await OrderService.releaseStock(allItems);
      throw error;
    }

    let subOrders: SubOrderDocument[];
    try {
      subOrders = await OrderService.insertSubOrders(order, slices);
    } catch (error) {
      // A parent with no parts is worse than no order at all: it would show
      // up in the customer's history as an empty, unfulfillable row.
      await Order.deleteOne({ _id: order._id }).catch((cleanupError: unknown) => {
        console.error(
          `Failed to remove order ${order.orderNumber} after its sub-orders could not be created`,
          cleanupError,
        );
      });
      await OrderService.releaseStock(allItems);
      throw error;
    }

    await OrderService.clearOrderedLines(user, allItems);

    // Fire-and-forget, and deliberately the last thing that happens: the
    // order is already durable by this point, so a mail failure cannot
    // roll anything back. `sendOrderConfirmationEmail` never throws and
    // never awaits — see `utils/email.ts`.
    sendOrderConfirmationEmail({
      to: user.email,
      customerName: user.firstName,
      orderNumber: order.orderNumber,
      total: order.pricing.grandTotal,
      items: allItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
    });

    return { order, subOrders };
  }

  // ---------- Commands: cancellation ----------

  /**
   * Customer-initiated cancellation of the whole order.
   *
   * Cancels every part that has not shipped yet and leaves the rest alone,
   * because that is the honest outcome: one shop having already handed a
   * parcel to a courier is no reason to keep charging the customer for the
   * two that haven't.
   */
  async cancelMine(
    user: IUserDocument,
    id: string,
    reason?: string,
  ): Promise<OrderWithSubOrders> {
    const order = await OrderService.loadById(id);
    OrderService.assertReadable(order, user);

    const subOrders = await SubOrder.find({ order: order._id });
    const cancellable = subOrders.filter((subOrder) =>
      OrderService.CUSTOMER_CANCELLABLE.includes(subOrder.status),
    );

    if (cancellable.length === 0) {
      throw ApiError.conflict(
        "Nothing in this order can still be cancelled — contact support instead",
      );
    }

    for (const subOrder of cancellable) {
      await OrderService.applyCancellation(subOrder, reason ?? null, user._id);
    }

    await OrderService.syncParent(order._id);

    return OrderService.withSubOrders(await OrderService.reload(order._id));
  }

  /** Cancels just one shop's part, leaving the rest of the order standing. */
  async cancelSubOrderMine(
    user: IUserDocument,
    subOrderId: string,
    reason?: string,
  ): Promise<SubOrderDocument> {
    const subOrder = await OrderService.loadSubOrder(subOrderId);

    if (
      !subOrder.user.equals(user._id) &&
      !OrderService.PRIVILEGED_ROLES.includes(user.role)
    ) {
      // A 403 here would confirm that a sub-order with that id exists.
      throw ApiError.notFound("Order not found");
    }

    if (!OrderService.CUSTOMER_CANCELLABLE.includes(subOrder.status)) {
      throw ApiError.conflict(
        `This part of your order is already ${subOrder.status.toLowerCase()} and cannot be cancelled — contact support instead`,
      );
    }

    const cancelled = await OrderService.applyCancellation(
      subOrder,
      reason ?? null,
      user._id,
    );

    await OrderService.syncParent(cancelled.order);

    return cancelled;
  }

  // ---------- Commands: fulfilment ----------

  /**
   * Moves one shop's part through the fulfilment states.
   *
   * Used by both the vendor (on their own sub-orders) and by admins (on
   * any), because the transition rules are identical — only who is allowed
   * to ask differs, and that is settled by `assertSubOrderManageable`.
   *
   * The write is guarded on the status we read, so two people clicking at
   * once cannot both apply a transition (and, for a cancellation, cannot
   * both restock).
   */
  async updateSubOrderStatus(
    actor: IUserDocument,
    subOrderId: string,
    input: UpdateSubOrderStatusInput,
  ): Promise<SubOrderDocument> {
    const subOrder = await OrderService.loadSubOrder(subOrderId);
    await OrderService.assertSubOrderManageable(subOrder, actor);

    const next = input.status;
    const note = input.note ?? null;

    if (next === subOrder.status) {
      throw ApiError.badRequest(
        `This part of the order is already ${subOrder.status.toLowerCase()}`,
      );
    }

    if (!OrderService.ALLOWED_TRANSITIONS[subOrder.status].includes(next)) {
      throw ApiError.conflict(
        `Cannot move an order from ${subOrder.status.toLowerCase()} to ${next.toLowerCase()}`,
      );
    }

    let updated: SubOrderDocument;

    if (next === "CANCELLED") {
      updated = await OrderService.applyCancellation(
        subOrder,
        note,
        actor._id,
      );
    } else {
      const set: Record<string, unknown> = { status: next };

      if (next === "SHIPPED") {
        set["shipment"] = {
          courier: input.courier ?? null,
          trackingNumber: input.trackingNumber ?? null,
          shippedAt: new Date(),
        };
      }

      if (next === "DELIVERED") {
        set["deliveredAt"] = new Date();

        // Cash on delivery is settled by the courier handing the parcel
        // over, so delivery *is* the payment event — and in a marketplace
        // it happens once per shop, not once per order.
        if (
          subOrder.paymentMethod === "COD" &&
          subOrder.paymentStatus === "PENDING"
        ) {
          set["paymentStatus"] = "PAID";
        }

        // Delivered *and* paid for is the moment the vendor's money stops
        // being contingent on anything.
        const paid =
          subOrder.paymentStatus === "PAID" || set["paymentStatus"] === "PAID";
        if (paid && subOrder.payoutState === "PENDING") {
          set["payoutState"] = "PAYABLE" satisfies PayoutState;
        }
      }

      updated = await OrderService.transition(subOrder, set, {
        status: next,
        at: new Date(),
        note,
        by: actor._id,
      });
    }

    await OrderService.syncParent(updated.order);

    return updated;
  }

  // ---------- Commands: payment ----------

  /**
   * Payment state moves independently of fulfilment (a card can settle
   * while the parcel is still being packed), so it has its own small
   * machine rather than being folded into the status transitions.
   *
   * Applied to the parent and mirrored onto every part that is still live:
   * the customer pays once, for the whole basket.
   */
  async updatePaymentStatus(
    id: string,
    paymentStatus: PaymentStatus,
    note: string | null,
    actor: IUserDocument,
  ): Promise<OrderWithSubOrders> {
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

    await OrderService.propagatePayment(updated._id, paymentStatus);

    return OrderService.withSubOrders(updated);
  }

  /**
   * The payment gateway's verdict, applied by the payment module.
   *
   * Unlike `updatePaymentStatus` this is **idempotent rather than strict**,
   * because the caller is a redirect a customer can replay by refreshing
   * the tab, and eSewa's own status API is polled on top of that. An
   * outcome the order has already recorded is a no-op, not a 409 — a paid
   * order must not start returning errors because the customer pressed
   * back.
   *
   * `by` is null throughout: nobody clicked this, a gateway said it.
   */
  async applyPaymentOutcome(
    orderId: Types.ObjectId,
    outcome: Extract<PaymentStatus, "PAID" | "FAILED" | "REFUNDED">,
    note: string,
  ): Promise<OrderDocument> {
    const order = await OrderService.reload(orderId);

    if (order.paymentStatus === outcome) return order;

    if (
      !OrderService.PAYMENT_TRANSITIONS[order.paymentStatus].includes(outcome)
    ) {
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
    if (!updated) {
      return OrderService.reload(order._id);
    }

    await OrderService.propagatePayment(updated._id, outcome);
    await OrderService.syncParent(updated._id);

    // Safe to send exactly once despite this method being replayable: the
    // `paymentStatus === outcome` guard above returns early on every
    // repeat, and the conditional update means only the caller that won
    // the race gets here.
    if (outcome === "PAID") {
      await OrderService.notifyPaymentReceived(updated);
    }

    return OrderService.reload(updated._id);
  }

  /**
   * Receipt for a captured payment. Separate from the transition above so
   * a lookup failure cannot leave a paid order half-updated: this runs
   * after the write is committed, and swallows its own errors.
   */
  private static async notifyPaymentReceived(
    order: OrderDocument,
  ): Promise<void> {
    try {
      const customer = await User.findById(order.user).select("email").lean();
      if (!customer?.email) return;

      sendPaymentReceivedEmail({
        to: customer.email,
        orderNumber: order.orderNumber,
        amount: order.pricing.grandTotal,
        method: order.paymentMethod,
      });
    } catch (error) {
      console.error(
        `Failed to send payment receipt for order ${order.orderNumber}`,
        error,
      );
    }
  }

  // ---------- Internals: reads ----------

  private static async loadById(id: string): Promise<OrderDocument> {
    // The routes validate this, but an unvalidated caller would otherwise
    // get a Mongoose CastError rendered as a 500 instead of a clean 404.
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound("Order not found");
    }
    return OrderService.reload(new Types.ObjectId(id));
  }

  private static async reload(id: Types.ObjectId): Promise<OrderDocument> {
    const order = await Order.findById(id);
    if (!order) {
      throw ApiError.notFound("Order not found");
    }
    return order;
  }

  private static async loadSubOrder(id: string): Promise<SubOrderDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound("Order not found");
    }

    const subOrder = await SubOrder.findById(id);
    if (!subOrder) {
      throw ApiError.notFound("Order not found");
    }
    return subOrder;
  }

  private static async withSubOrders(
    order: OrderDocument,
  ): Promise<OrderWithSubOrders> {
    const subOrders = await SubOrder.find({ order: order._id }).sort({
      subOrderNumber: 1,
    });
    return { order, subOrders };
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

  /** The caller's shop, for the vendor-scoped queues. */
  private static async vendorOf(
    user: IUserDocument,
  ): Promise<VendorDocument> {
    const vendor = await Vendor.findOne({ owner: user._id, ...NOT_DELETED });
    if (!vendor) {
      throw ApiError.forbidden("You do not have a seller account");
    }
    return vendor;
  }

  /**
   * Whether this actor may move this sub-order.
   *
   * A vendor may only touch their own; an admin may touch any. Note the
   * vendor check is against the *shop*, not the product owner — a shop
   * could later have staff accounts, and fulfilment is the shop's job.
   */
  private static async assertSubOrderManageable(
    subOrder: SubOrderDocument,
    user: IUserDocument,
  ): Promise<void> {
    if (OrderService.PRIVILEGED_ROLES.includes(user.role)) return;

    const vendor = await OrderService.vendorOf(user);
    if (!vendor._id.equals(subOrder.vendor)) {
      throw ApiError.notFound("Order not found");
    }
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

  private static async pageSubOrders(
    filter: QueryFilter<ISubOrder>,
    query: Pick<ListSubOrdersQuery, "page" | "limit" | "sort">,
  ): Promise<SubOrderPage> {
    const { page, limit, sort } = query;

    const [data, total] = await Promise.all([
      SubOrder.find(filter)
        .sort(OrderService.SORT_STAGES[sort])
        .skip((page - 1) * limit)
        .limit(limit),
      SubOrder.countDocuments(filter),
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
    if (orderNumber) filter.orderNumber = prefixRegex(orderNumber);

    if (from || to) {
      filter.placedAt = {
        ...(from && { $gte: from }),
        ...(to && { $lte: to }),
      };
    }

    return filter;
  }

  private static buildSubOrderFilter(
    query: ListSubOrdersQuery,
  ): QueryFilter<ISubOrder> {
    const filter: QueryFilter<ISubOrder> = {};

    if (query.status) filter.status = query.status;
    if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
    if (query.payoutState) filter.payoutState = query.payoutState;
    if (query.vendor) filter.vendor = new Types.ObjectId(query.vendor);
    if (query.orderNumber) filter.orderNumber = prefixRegex(query.orderNumber);

    if (query.from || query.to) {
      filter.placedAt = {
        ...(query.from && { $gte: query.from }),
        ...(query.to && { $lte: query.to }),
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

    // A shop suspended (or still awaiting approval) since the item was
    // added cannot be checked out from: nobody would be able to fulfil it,
    // and the money would be owed to an account we have stopped paying.
    const closed = items.filter((item) => !item.vendorActive);
    if (closed.length > 0) {
      const shops = [
        ...new Set(closed.map((item) => item.vendorName ?? "Unknown shop")),
      ].join(", ");
      throw ApiError.conflict(
        `${shops} ${closed.length === 1 ? "is" : "are"} not accepting orders right now. Remove those items and try again.`,
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

  /**
   * Groups the cart by shop and prices each group.
   *
   * The vendors are re-read here rather than trusted from the cart's join,
   * because this is where the commission rate is captured — and a rate is
   * the one figure that must come from the record, not from a projection
   * assembled for a shopping-cart screen.
   */
  private static async split(items: CartItemView[]): Promise<VendorSlice[]> {
    const grouped = new Map<string, CartItemView[]>();

    for (const item of items) {
      // `assertPurchasable` has already rejected lines with no live shop.
      const key = (item.vendorId ?? "").toString();
      const bucket = grouped.get(key);
      if (bucket) {
        bucket.push(item);
      } else {
        grouped.set(key, [item]);
      }
    }

    const ids = [...grouped.keys()].map((id) => new Types.ObjectId(id));
    const vendors = await Vendor.find({
      _id: { $in: ids },
      status: SELLABLE_STATUS,
      ...NOT_DELETED,
    });

    if (vendors.length !== grouped.size) {
      throw ApiError.conflict(
        "One of the shops in your cart stopped accepting orders. Reload your cart and try again.",
      );
    }

    return vendors.map((vendor) => {
      const lines = grouped.get(vendor._id.toString()) ?? [];
      const orderItems = lines.map(OrderService.toOrderItem);
      const pricing = OrderService.price(orderItems);

      return {
        vendor,
        items: orderItems,
        pricing,
        earnings: OrderService.splitEarnings(pricing, vendor.commissionRate),
      };
    });
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

  /**
   * One shop's charges. Derived here and nowhere else, from the same
   * policy the cart preview quoted.
   */
  private static price(items: IOrderItem[]): IOrderPricing {
    const subtotal = money(
      items.reduce((total, item) => total + item.lineTotal, 0),
    );

    const shippingFee = shippingFeeFor(subtotal);
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
   * Splits one sub-order's money between the platform and the vendor.
   *
   * Commission is charged on the **goods subtotal only**. Delivery is
   * passed through in full because the vendor pays the courier — taking a
   * percentage of it would charge them a cut of their own costs — and tax
   * is never theirs to begin with, so it is in neither figure.
   */
  private static splitEarnings(
    pricing: IOrderPricing,
    vendorRate: number | null,
  ): ISubOrderEarnings {
    const commissionRate = commissionRateFor(vendorRate);
    const commissionAmount = money(pricing.subtotal * commissionRate);

    return {
      commissionRate,
      commissionAmount,
      vendorEarning: money(
        pricing.subtotal - commissionAmount + pricing.shippingFee,
      ),
    };
  }

  /** The parent order's totals: every shop's charges added up. */
  private static combine(slices: VendorSlice[]): IOrderPricing {
    const sum = (pick: (pricing: IOrderPricing) => number): number =>
      money(slices.reduce((total, slice) => total + pick(slice.pricing), 0));

    return {
      subtotal: sum((pricing) => pricing.subtotal),
      shippingFee: sum((pricing) => pricing.shippingFee),
      taxTotal: sum((pricing) => pricing.taxTotal),
      discountTotal: sum((pricing) => pricing.discountTotal),
      grandTotal: sum((pricing) => pricing.grandTotal),
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
   * Inserts the parent order, regenerating the reference if the random
   * suffix collides with an existing one.
   */
  private static async insertOrder(
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
   * One sub-order per shop, numbered `<orderNumber>-1`, `-2`, …
   *
   * Derived from the parent's reference rather than randomised: a customer
   * on the phone reads one number, and support needs to see at a glance
   * that `ORD-20260901-K3F9QZ-2` is the second parcel of that same order.
   */
  private static insertSubOrders(
    order: OrderDocument,
    slices: VendorSlice[],
  ): Promise<SubOrderDocument[]> {
    const now = new Date();

    const documents = slices.map((slice, index) => ({
      order: order._id,
      orderNumber: order.orderNumber,
      subOrderNumber: `${order.orderNumber}-${String(index + 1)}`,
      user: order.user,
      vendor: slice.vendor._id,
      items: slice.items,
      pricing: slice.pricing,
      earnings: slice.earnings,
      status: "PENDING" as OrderStatus,
      paymentStatus: "PENDING" as PaymentStatus,
      paymentMethod: order.paymentMethod,
      statusHistory: [
        {
          status: "PENDING" as OrderStatus,
          at: now,
          note: "Order placed",
          by: null,
        },
      ],
      shipment: { courier: null, trackingNumber: null, shippedAt: null },
      payoutState: "PENDING" as PayoutState,
      payout: null,
      placedAt: now,
      deliveredAt: null,
      cancelledAt: null,
      cancelReason: null,
    }));

    return SubOrder.insertMany(documents);
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
    subOrder: SubOrderDocument,
    set: Record<string, unknown>,
    event: IOrderStatusEvent,
  ): Promise<SubOrderDocument> {
    const updated = await SubOrder.findOneAndUpdate(
      { _id: subOrder._id, status: subOrder.status },
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
   * Cancels one shop's part and restocks it, in that order.
   *
   * The status write goes first *because* it is guarded: only the caller
   * that actually moved the sub-order out of its previous status restocks
   * it, so a double-click cannot return the units twice.
   */
  private static async applyCancellation(
    subOrder: SubOrderDocument,
    reason: string | null,
    by: Types.ObjectId,
  ): Promise<SubOrderDocument> {
    const now = new Date();

    const set: Record<string, unknown> = {
      status: "CANCELLED",
      cancelledAt: now,
      cancelReason: reason,
    };

    // Money already taken has to go back; an unpaid part just stops.
    if (subOrder.paymentStatus === "PAID") {
      set["paymentStatus"] = "REFUNDED";
    }

    // Nothing is owed for goods that were never delivered. A part already
    // paid out is left alone — clawing that back is the payout module's
    // job, and silently rewriting a settled payment would hide it.
    if (
      subOrder.payoutState === "PENDING" ||
      subOrder.payoutState === "PAYABLE"
    ) {
      set["payoutState"] = "REVERSED" satisfies PayoutState;
    }

    const cancelled = await OrderService.transition(subOrder, set, {
      status: "CANCELLED",
      at: now,
      note: reason,
      by,
    });

    await OrderService.releaseStock(cancelled.items);

    return cancelled;
  }

  /**
   * Mirrors a payment outcome onto every part that is still live.
   *
   * Three separate writes, because they are scoped to three different sets
   * of sub-orders and folding them into one would silently skip parts:
   * the payment itself applies to *every* live part (including ones a shop
   * has already started packing), the confirmation only to parts still
   * waiting on it, and the payout release only to parts already delivered.
   */
  private static async propagatePayment(
    orderId: Types.ObjectId,
    paymentStatus: PaymentStatus,
  ): Promise<void> {
    try {
      await SubOrder.updateMany(
        { order: orderId, status: { $ne: "CANCELLED" } },
        { $set: { paymentStatus } },
      );

      if (paymentStatus !== "PAID") return;

      // A prepaid order is confirmed the moment it settles, for every shop
      // that has not moved past waiting.
      await SubOrder.updateMany(
        { order: orderId, status: "PENDING" },
        { $set: { status: "CONFIRMED" } },
      );

      // A part delivered before the money landed has been sitting on
      // `PENDING` with nothing left to wait for. Payment is the last
      // condition, so it becomes payable now rather than never.
      await SubOrder.updateMany(
        { order: orderId, status: "DELIVERED", payoutState: "PENDING" },
        { $set: { payoutState: "PAYABLE" satisfies PayoutState } },
      );
    } catch (error) {
      console.error(
        `Failed to propagate payment ${paymentStatus} to the parts of order ${orderId.toString()}`,
        error,
      );
    }
  }

  /**
   * An order is only as far along as its least-advanced live part.
   *
   * Half shipped and half still being packed is a *processing* order — the
   * customer has not received everything, so claiming otherwise would be a
   * lie on their order history. All parts cancelled means the order is.
   */
  private static deriveStatus(statuses: OrderStatus[]): OrderStatus {
    const live = statuses.filter((status) => status !== "CANCELLED");
    if (live.length === 0) return "CANCELLED";

    return live.reduce((lowest, status) =>
      OrderService.STATUS_RANK[status] < OrderService.STATUS_RANK[lowest]
        ? status
        : lowest,
    );
  }

  /**
   * Recomputes the parent's derived fields from its parts.
   *
   * Called after every sub-order transition. It writes `status` and (for
   * cash on delivery, which settles per parcel) `paymentStatus` directly
   * rather than going through the transition guards — those guard
   * *commands*, and this is the shadow of decisions already made and
   * validated on the sub-orders.
   *
   * Best-effort: the sub-order transition is the source of truth and has
   * already committed, so a failure here leaves a stale summary rather
   * than losing the fulfilment step that caused it.
   */
  private static async syncParent(orderId: Types.ObjectId): Promise<void> {
    try {
      const parts = await SubOrder.find({ order: orderId }).select(
        "status paymentStatus deliveredAt",
      );

      if (parts.length === 0) return;

      const status = OrderService.deriveStatus(
        parts.map((part) => part.status),
      );

      const set: Record<string, unknown> = { status };
      const now = new Date();

      if (status === "DELIVERED") {
        set["deliveredAt"] = now;
      }
      if (status === "CANCELLED") {
        set["cancelledAt"] = now;
      }

      const live = parts.filter((part) => part.status !== "CANCELLED");

      const order = await Order.findById(orderId).select(
        "paymentMethod paymentStatus",
      );

      // Cash on delivery is collected once per parcel, so the order is only
      // paid once every live part has been. Prepaid orders are settled by
      // the gateway on the parent and mirrored downwards, never derived.
      if (
        order?.paymentMethod === "COD" &&
        live.length > 0 &&
        live.every((part) => part.paymentStatus === "PAID")
      ) {
        set["paymentStatus"] = "PAID";
      }

      // Every shop cancelled means the whole order was, so money already
      // taken is owed back in full. A *partial* cancellation deliberately
      // leaves the parent `PAID`: the customer is still paying for the
      // parcels that are on their way, and the refund for the rest is
      // recorded on the sub-orders that were cancelled.
      if (
        status === "CANCELLED" &&
        live.length === 0 &&
        order?.paymentStatus === "PAID"
      ) {
        set["paymentStatus"] = "REFUNDED";
      }

      await Order.updateOne({ _id: orderId }, { $set: set });
    } catch (error) {
      console.error(
        `Failed to recompute the summary of order ${orderId.toString()}`,
        error,
      );
    }
  }
}

export const orderService = new OrderService();
