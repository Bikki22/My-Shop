import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";
import { userController } from "./user.controller.js";
import {
  listUsersQuerySchema,
  updateMeBodySchema,
  updateUserRoleBodySchema,
  updateUserStatusBodySchema,
  userIdParamSchema,
} from "./user.validation.js";

const router = Router();

const requireAdmin = requireRole("ADMIN", "SUPER_ADMIN");

// ---------- Self-service ----------
// These must stay above `/:id`, or Express would match "me" as an id.

router.get("/me", requireAuth, userController.getMe);

router.patch(
  "/me",
  requireAuth,
  validateBody(updateMeBodySchema),
  userController.updateMe,
);

router.delete("/me", requireAuth, userController.deleteMe);

// ---------- Admin ----------

router.get(
  "/",
  requireAuth,
  requireAdmin,
  validateQuery(listUsersQuerySchema),
  userController.list,
);

router.get(
  "/:id",
  requireAuth,
  requireAdmin,
  validateParams(userIdParamSchema),
  userController.getById,
);

router.patch(
  "/:id/role",
  requireAuth,
  requireAdmin,
  validateParams(userIdParamSchema),
  validateBody(updateUserRoleBodySchema),
  userController.updateRole,
);

router.patch(
  "/:id/status",
  requireAuth,
  requireAdmin,
  validateParams(userIdParamSchema),
  validateBody(updateUserStatusBodySchema),
  userController.updateStatus,
);

export default router;
