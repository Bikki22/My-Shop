import { Router } from "express";
import { requireAuth, requireRole } from "../../middlewares/auth.middleware.js";
import * as userController from "./user.controller.js";

const router = Router();

router.get("/me", requireAuth, userController.getMe);
router.patch("/me", requireAuth, userController.updateMe);
router.delete("/me", requireAuth, userController.deleteMe);

router.get(
  "/",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  userController.listUsers,
);
router.get(
  "/:id",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  userController.getUserById,
);
router.patch(
  "/:id/role",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  userController.updateUserRole,
);
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("ADMIN", "SUPER_ADMIN"),
  userController.updateUserStatus,
);

export default router;
