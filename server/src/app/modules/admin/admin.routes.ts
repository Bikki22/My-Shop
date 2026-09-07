import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import { validateQuery } from "../../middlewares/validate.middleware.js";
import { adminController } from "./admin.controller.js";
import {
  overviewQuerySchema,
  timeseriesQuerySchema,
} from "./admin.validation.js";

const router = Router();

const requireAdmin = requireRole("ADMIN", "SUPER_ADMIN");

// Nothing here is public, and none of it is cheap: every route runs at
// least one aggregation across the sales collection.
router.use(requireAuth);

// ---------- Platform ----------
// The whole marketplace, for whoever runs it.

/** Headline counters: sales, shops, customers, catalogue, money owed. */
router.get(
  "/overview",
  requireAdmin,
  validateQuery(overviewQuerySchema),
  adminController.overview,
);

/** The same sales, bucketed by day or month for the revenue chart. */
router.get(
  "/revenue",
  requireAdmin,
  validateQuery(timeseriesQuerySchema),
  adminController.revenue,
);

// ---------- Vendor ----------
// One shop, scoped to the signed-in owner. No role guard: the shop is
// resolved from `req.user`, so a customer reaches a 403 from the service
// rather than seeing anyone else's numbers.

router.get(
  "/me/overview",
  validateQuery(overviewQuerySchema),
  adminController.myOverview,
);

router.get(
  "/me/sales",
  validateQuery(timeseriesQuerySchema),
  adminController.mySales,
);

export default router;
