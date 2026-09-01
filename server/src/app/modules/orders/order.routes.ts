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
  listSubOrdersQuerySchema,
  orderIdParamSchema,
  orderNumberParamSchema,
  subOrderIdParamSchema,
  updatePaymentStatusBodySchema,
  updateSubOrderStatusBodySchema,
} from "./order.validation.js";

const router = Router();

const requireAdmin = requireRole("ADMIN", "SUPER_ADMIN");

// Every order route is personal to someone, so `requireAuth` guards the
// whole router; the admin routes add a role check on top.
router.use(requireAuth);

// ---------- Admin ----------
// These sit above `/:id`, because `/admin` would otherwise be matched as an
// order id and rejected by the param validator.

router.get(
  "/admin",
  requireAdmin,
  validateQuery(listOrdersQuerySchema),
  orderController.list,
);

/** The platform-wide fulfilment queue, across every shop. */
router.get(
  "/admin/sub-orders",
  requireAdmin,
  validateQuery(listSubOrdersQuerySchema),
  orderController.listSubOrders,
);

router.patch(
  "/admin/sub-orders/:subOrderId/status",
  requireAdmin,
  validateParams(subOrderIdParamSchema),
  validateBody(updateSubOrderStatusBodySchema),
  orderController.updateSubOrderStatus,
);

router.get(
  "/admin/:id",
  requireAdmin,
  validateParams(orderIdParamSchema),
  orderController.getById,
);

router.patch(
  "/admin/:id/payment",
  requireAdmin,
  validateParams(orderIdParamSchema),
  validateBody(updatePaymentStatusBodySchema),
  orderController.updatePaymentStatus,
);

// ---------- Vendor ----------
// A shop's own queue. Never takes a vendor id: the scope comes from the
// caller's shop, so one vendor cannot read another's orders.

router.get(
  "/vendor",
  validateQuery(listSubOrdersQuerySchema),
  orderController.listForVendor,
);

router.get(
  "/vendor/:subOrderId",
  validateParams(subOrderIdParamSchema),
  orderController.getSubOrderForVendor,
);

router.patch(
  "/vendor/:subOrderId/status",
  validateParams(subOrderIdParamSchema),
  validateBody(updateSubOrderStatusBodySchema),
  orderController.updateSubOrderStatus,
);

// ---------- Customer ----------

/** Checkout: the body carries only an address and a payment method — the
 * lines, the per-shop split and every money figure come from the cart. */
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

/** Cancel one shop's parcel rather than the whole order. */
router.patch(
  "/sub-orders/:subOrderId/cancel",
  validateParams(subOrderIdParamSchema),
  validateBody(cancelOrderBodySchema),
  orderController.cancelSubOrderMine,
);

router.get("/:id", validateParams(orderIdParamSchema), orderController.getMine);

router.patch(
  "/:id/cancel",
  validateParams(orderIdParamSchema),
  validateBody(cancelOrderBodySchema),
  orderController.cancelMine,
);

export default router;
