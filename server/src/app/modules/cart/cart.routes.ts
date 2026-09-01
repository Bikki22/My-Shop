import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
} from "../../middlewares/validate.middleware.js";
import { cartController } from "./cart.controller.js";
import {
  addCartItemBodySchema,
  cartItemParamSchema,
  updateCartItemBodySchema,
} from "./cart.validation.js";

const router = Router();

// A cart belongs to exactly one user and is always addressed as "mine",
// so `requireAuth` guards the whole router rather than each route.
router.use(requireAuth);

router.get("/", cartController.getMine);

router.get("/counts", cartController.getCounts);

router.post(
  "/items",
  validateBody(addCartItemBodySchema),
  cartController.addItem,
);

router.patch(
  "/items/:productId",
  validateParams(cartItemParamSchema),
  validateBody(updateCartItemBodySchema),
  cartController.setItemQuantity,
);

router.delete(
  "/items/:productId",
  validateParams(cartItemParamSchema),
  cartController.removeItem,
);

router.delete("/", cartController.clear);

export default router;
