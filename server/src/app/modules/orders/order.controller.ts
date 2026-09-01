import { asyncHandler } from "../../utils/async-handler.js";
import { currentUser } from "../../utils/current-user.js";
import { orderService, OrderService } from "./order.service.js";
import type {
  CancelOrderInput,
  CreateOrderInput,
  ListMyOrdersQuery,
  ListOrdersQuery,
  ListSubOrdersQuery,
  UpdatePaymentStatusInput,
  UpdateSubOrderStatusInput,
} from "./order.validation.js";

/**
 * HTTP boundary only: unwrap the request, delegate, shape the response.
 * Bodies/params/queries are already validated by the route's middleware,
 * which is what makes the casts below safe.
 */
export class OrderController {
  constructor(private readonly service: OrderService) {}

  // ---------- Customer ----------

  /** 201: checkout creates a resource, unlike the cart's mutations. */
  create = asyncHandler(async (req, res) => {
    const result = await this.service.checkout(
      currentUser(req),
      req.body as CreateOrderInput,
    );
    return res.status(201).json({ success: true, ...result });
  });

  listMine = asyncHandler(async (req, res) => {
    const result = await this.service.listMine(
      currentUser(req),
      req.validatedQuery as ListMyOrdersQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getMine = asyncHandler<{ id: string }>(async (req, res) => {
    const result = await this.service.getForUser(
      req.params.id,
      currentUser(req),
    );
    return res.status(200).json({ success: true, ...result });
  });

  getByNumber = asyncHandler<{ orderNumber: string }>(async (req, res) => {
    const result = await this.service.getByNumber(
      req.params.orderNumber,
      currentUser(req),
    );
    return res.status(200).json({ success: true, ...result });
  });

  cancelMine = asyncHandler<{ id: string }>(async (req, res) => {
    const { reason } = req.body as CancelOrderInput;
    const result = await this.service.cancelMine(
      currentUser(req),
      req.params.id,
      reason,
    );
    return res.status(200).json({ success: true, ...result });
  });

  /** Cancels one shop's parcel, leaving the rest of the order standing. */
  cancelSubOrderMine = asyncHandler<{ subOrderId: string }>(
    async (req, res) => {
      const { reason } = req.body as CancelOrderInput;
      const subOrder = await this.service.cancelSubOrderMine(
        currentUser(req),
        req.params.subOrderId,
        reason,
      );
      return res.status(200).json({ success: true, data: subOrder });
    },
  );

  // ---------- Vendor ----------

  listForVendor = asyncHandler(async (req, res) => {
    const result = await this.service.listForVendor(
      currentUser(req),
      req.validatedQuery as ListSubOrdersQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getSubOrderForVendor = asyncHandler<{ subOrderId: string }>(
    async (req, res) => {
      const subOrder = await this.service.getSubOrderForVendor(
        currentUser(req),
        req.params.subOrderId,
      );
      return res.status(200).json({ success: true, data: subOrder });
    },
  );

  /**
   * Shared by the vendor and admin routes: the transition rules are the
   * same, and who may ask is settled inside the service.
   */
  updateSubOrderStatus = asyncHandler<{ subOrderId: string }>(
    async (req, res) => {
      const subOrder = await this.service.updateSubOrderStatus(
        currentUser(req),
        req.params.subOrderId,
        req.body as UpdateSubOrderStatusInput,
      );
      return res.status(200).json({ success: true, data: subOrder });
    },
  );

  // ---------- Admin ----------

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(
      req.validatedQuery as ListOrdersQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler<{ id: string }>(async (req, res) => {
    const result = await this.service.getForUser(
      req.params.id,
      currentUser(req),
    );
    return res.status(200).json({ success: true, ...result });
  });

  listSubOrders = asyncHandler(async (req, res) => {
    const result = await this.service.listSubOrders(
      req.validatedQuery as ListSubOrdersQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  updatePaymentStatus = asyncHandler<{ id: string }>(async (req, res) => {
    const { paymentStatus, note } = req.body as UpdatePaymentStatusInput;
    const result = await this.service.updatePaymentStatus(
      req.params.id,
      paymentStatus,
      note ?? null,
      currentUser(req),
    );
    return res.status(200).json({ success: true, ...result });
  });
}

export const orderController = new OrderController(orderService);
