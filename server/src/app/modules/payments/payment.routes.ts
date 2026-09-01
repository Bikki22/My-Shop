import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";
import { paymentController } from "./payment.controller.js";
import {
  esewaCallbackQuerySchema,
  esewaFailureQuerySchema,
  initiatePaymentBodySchema,
  orderIdParamSchema,
  transactionUuidParamSchema,
} from "./payment.validation.js";

const router = Router();

const requireAdmin = requireRole("ADMIN", "SUPER_ADMIN");

// ---------- Gateway redirects ----------
// Public on purpose: these are browser navigations coming from eSewa's
// domain, where our session cookie is not reliably sent. They are trusted
// on the strength of the signed payload and the status-API check, never on
// the caller's identity — see PaymentService.settleFromCallback.

router.get(
  "/esewa/success",
  validateQuery(esewaCallbackQuerySchema),
  paymentController.esewaSuccess,
);

router.get(
  "/esewa/failure",
  validateQuery(esewaFailureQuerySchema),
  paymentController.esewaFailure,
);

// ---------- Admin ----------
// Above `/:transactionUuid`, or "admin" would be read as a reference.

router.post(
  "/admin/reconcile",
  requireAuth,
  requireAdmin,
  paymentController.reconcileOpen,
);

// ---------- Customer ----------

router.post(
  "/esewa/initiate",
  requireAuth,
  validateBody(initiatePaymentBodySchema),
  paymentController.initiateEsewa,
);

router.get(
  "/order/:orderId",
  requireAuth,
  validateParams(orderIdParamSchema),
  paymentController.listForOrder,
);

router.get(
  "/:transactionUuid",
  requireAuth,
  validateParams(transactionUuidParamSchema),
  paymentController.reconcile,
);

export default router;
