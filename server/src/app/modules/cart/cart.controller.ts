import type { Request } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { IUserDocument } from "../users/user.model.js";
import { cartService, CartService } from "./cart.service.js";
import type {
  AddCartItemInput,
  UpdateCartItemInput,
} from "./cart.validation.js";

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
 *
 * Every mutation answers with the whole recalculated cart — the client
 * would otherwise have to follow each write with a GET to refresh totals.
 */
export class CartController {
  constructor(private readonly service: CartService) {}

  getMine = asyncHandler(async (req, res) => {
    const cart = await this.service.getMine(currentUser(req));
    return res.status(200).json({ success: true, data: cart });
  });

  getCounts = asyncHandler(async (req, res) => {
    const counts = await this.service.getCounts(currentUser(req));
    return res.status(200).json({ success: true, data: counts });
  });

  addItem = asyncHandler(async (req, res) => {
    const cart = await this.service.addItem(
      currentUser(req),
      req.body as AddCartItemInput,
    );
    return res.status(200).json({ success: true, data: cart });
  });

  setItemQuantity = asyncHandler<{ productId: string }>(async (req, res) => {
    const { quantity } = req.body as UpdateCartItemInput;
    const cart = await this.service.setItemQuantity(
      currentUser(req),
      req.params.productId,
      quantity,
    );
    return res.status(200).json({ success: true, data: cart });
  });

  removeItem = asyncHandler<{ productId: string }>(async (req, res) => {
    const cart = await this.service.removeItem(
      currentUser(req),
      req.params.productId,
    );
    return res.status(200).json({ success: true, data: cart });
  });

  clear = asyncHandler(async (req, res) => {
    const cart = await this.service.clear(currentUser(req));
    return res.status(200).json({ success: true, data: cart });
  });
}

export const cartController = new CartController(cartService);
