import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";
import { orderController } from "./order.controller.js";
import {
  cancelOrderBodySchema,
  createOrderBodySchema,
  listMyOrdersQuerySchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
  orderNumberParamSchema,
  updateOrderStatusBodySchema,
  updatePaymentStatusBodySchema,
} from "./order.validation.js";

const router = Router();

const requireAdmin = requireRole("ADMIN", "SUPER_ADMIN");

// Every order route is personal to someone, so `requireAuth` guards the
// whole router; the admin routes add a role check on top.
router.use(requireAuth);

// ---------- Admin ----------
// These sit above `/:id` and `/me`, because `/admin` would otherwise be
// matched as an order id and rejected by the param validator.

router.get(
  "/admin",
  requireAdmin,
  validateQuery(listOrdersQuerySchema),
  orderController.list,
);

router.get(
  "/admin/:id",
  requireAdmin,
  validateParams(orderIdParamSchema),
  orderController.getById,
);

router.patch(
  "/admin/:id/status",
  requireAdmin,
  validateParams(orderIdParamSchema),
  validateBody(updateOrderStatusBodySchema),
  orderController.updateStatus,
);

router.patch(
  "/admin/:id/payment",
  requireAdmin,
  validateParams(orderIdParamSchema),
  validateBody(updatePaymentStatusBodySchema),
  orderController.updatePaymentStatus,
);

// ---------- Customer ----------

/** Checkout: the body carries only an address and a payment method — the
 * lines and every money figure come from the caller's cart. */
router.post("/", validateBody(createOrderBodySchema), orderController.create);

router.get(
  "/",
  validateQuery(listMyOrdersQuerySchema),
  orderController.listMine,
);

// Above `/:id` so "number" is never read as an id.
router.get(
  "/number/:orderNumber",
  validateParams(orderNumberParamSchema),
  orderController.getByNumber,
);

router.get("/:id", validateParams(orderIdParamSchema), orderController.getMine);

router.patch(
  "/:id/cancel",
  validateParams(orderIdParamSchema),
  validateBody(cancelOrderBodySchema),
  orderController.cancelMine,
);

export default router;
