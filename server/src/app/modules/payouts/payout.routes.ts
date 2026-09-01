import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";
import { payoutController } from "./payout.controller.js";
import {
  createPayoutBodySchema,
  listMyPayoutsQuerySchema,
  listPayoutsQuerySchema,
  markFailedBodySchema,
  markPaidBodySchema,
  payoutIdParamSchema,
} from "./payout.validation.js";

const router = Router();

const requireAdmin = requireRole("ADMIN", "SUPER_ADMIN");

// Money is never public.
router.use(requireAuth);

// ---------- Admin ----------
// Above `/:id`, or "admin" would be matched as a payout id.

router.get(
  "/admin",
  requireAdmin,
  validateQuery(listPayoutsQuerySchema),
  payoutController.list,
);

/** Who the platform currently owes, largest debt first. */
router.get("/admin/payable", requireAdmin, payoutController.listPayable);

router.get(
  "/admin/balance/:vendorId",
  requireAdmin,
  payoutController.balanceFor,
);

/** Starts a run: claims everything payable for one shop. */
router.post(
  "/admin",
  requireAdmin,
  validateBody(createPayoutBodySchema),
  payoutController.create,
);

router.patch(
  "/admin/:id/paid",
  requireAdmin,
  validateParams(payoutIdParamSchema),
  validateBody(markPaidBodySchema),
  payoutController.markPaid,
);

router.patch(
  "/admin/:id/failed",
  requireAdmin,
  validateParams(payoutIdParamSchema),
  validateBody(markFailedBodySchema),
  payoutController.markFailed,
);

// ---------- Vendor ----------

/** What this shop is owed, broken down by state. */
router.get("/me/balance", payoutController.myBalance);

router.get(
  "/me",
  validateQuery(listMyPayoutsQuerySchema),
  payoutController.listMine,
);

// Two segments, so this can never be shadowed by `/:id`.
router.get(
  "/:id/breakdown",
  validateParams(payoutIdParamSchema),
  payoutController.getBreakdown,
);

router.get(
  "/:id",
  validateParams(payoutIdParamSchema),
  payoutController.getById,
);

export default router;
