import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";
import { vendorController } from "./vendor.controller.js";
import {
  applyVendorBodySchema,
  listVendorsAdminQuerySchema,
  listVendorsQuerySchema,
  renameVendorBodySchema,
  reviewVendorBodySchema,
  updateCommissionBodySchema,
  updateMyVendorBodySchema,
  vendorIdParamSchema,
  vendorSlugParamSchema,
} from "./vendor.validation.js";

const router = Router();

const requireAdmin = requireRole("ADMIN", "SUPER_ADMIN");

// ---------- Admin ----------
// These sit above `/:id`, or "admin" would be matched as a shop id and
// rejected by the param validator.

router.get(
  "/admin",
  requireAuth,
  requireAdmin,
  validateQuery(listVendorsAdminQuerySchema),
  vendorController.adminList,
);

router.get(
  "/admin/:id",
  requireAuth,
  requireAdmin,
  validateParams(vendorIdParamSchema),
  vendorController.adminGetById,
);

/** Approve / reject / suspend — the whole review queue is this one route. */
router.patch(
  "/admin/:id/review",
  requireAuth,
  requireAdmin,
  validateParams(vendorIdParamSchema),
  validateBody(reviewVendorBodySchema),
  vendorController.review,
);

router.patch(
  "/admin/:id/commission",
  requireAuth,
  requireAdmin,
  validateParams(vendorIdParamSchema),
  validateBody(updateCommissionBodySchema),
  vendorController.updateCommission,
);

// Renaming re-slugs the storefront, so it is deliberately not something a
// vendor can do to itself — see VendorService.rename.
router.patch(
  "/admin/:id/name",
  requireAuth,
  requireAdmin,
  validateParams(vendorIdParamSchema),
  validateBody(renameVendorBodySchema),
  vendorController.rename,
);

// ---------- Self-service ----------
// Above `/:id` for the same reason as `/admin`.

router.post(
  "/apply",
  requireAuth,
  validateBody(applyVendorBodySchema),
  vendorController.apply,
);

router.get("/me", requireAuth, vendorController.getMine);

router.patch(
  "/me",
  requireAuth,
  validateBody(updateMyVendorBodySchema),
  vendorController.updateMine,
);

// ---------- Public ----------

router.get("/", validateQuery(listVendorsQuerySchema), vendorController.list);

// Two segments, so this can never be shadowed by `/:id` below.
router.get(
  "/slug/:slug",
  validateParams(vendorSlugParamSchema),
  vendorController.getBySlug,
);

router.get(
  "/:id",
  validateParams(vendorIdParamSchema),
  vendorController.getById,
);

export default router;
