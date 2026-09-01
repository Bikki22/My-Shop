import type { Request } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { IUserDocument } from "../users/user.model.js";
import { orderService, OrderService } from "./order.service.js";
import type {
  CancelOrderInput,
  CreateOrderInput,
  ListMyOrdersQuery,
  ListOrdersQuery,
  UpdateOrderStatusInput,
  UpdatePaymentStatusInput,
} from "./order.validation.js";

/**
 * `requireAuth` guarantees this, but the type system can't see across
 * middleware — this turns the invariant into a real check instead of a `!`.
 */
const currentUser = (req: Request): IUserDocument => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user;
};

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
    const order = await this.service.checkout(
      currentUser(req),
      req.body as CreateOrderInput,
    );
    return res.status(201).json({ success: true, data: order });
  });

  listMine = asyncHandler(async (req, res) => {
    const result = await this.service.listMine(
      currentUser(req),
      req.validatedQuery as ListMyOrdersQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getMine = asyncHandler<{ id: string }>(async (req, res) => {
    const order = await this.service.getForUser(
      req.params.id,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: order });
  });

  getByNumber = asyncHandler<{ orderNumber: string }>(async (req, res) => {
    const order = await this.service.getByNumber(
      req.params.orderNumber,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: order });
  });

  cancelMine = asyncHandler<{ id: string }>(async (req, res) => {
    const { reason } = req.body as CancelOrderInput;
    const order = await this.service.cancelMine(
      currentUser(req),
      req.params.id,
      reason,
    );
    return res.status(200).json({ success: true, data: order });
  });

  // ---------- Admin ----------

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(
      req.validatedQuery as ListOrdersQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler<{ id: string }>(async (req, res) => {
    const order = await this.service.getForUser(
      req.params.id,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: order });
  });

  updateStatus = asyncHandler<{ id: string }>(async (req, res) => {
    const order = await this.service.updateStatus(
      req.params.id,
      req.body as UpdateOrderStatusInput,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: order });
  });

  updatePaymentStatus = asyncHandler<{ id: string }>(async (req, res) => {
    const { paymentStatus, note } = req.body as UpdatePaymentStatusInput;
    const order = await this.service.updatePaymentStatus(
      req.params.id,
      paymentStatus,
      note ?? null,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: order });
  });
}

export const orderController = new OrderController(orderService);
