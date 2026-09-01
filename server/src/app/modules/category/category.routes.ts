import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";
import { categoryController } from "./category.controller.js";
import {
  categoryIdParamSchema,
  categorySlugParamSchema,
  createCategoryBodySchema,
  listCategoriesQuerySchema,
  updateCategoryBodySchema,
} from "./category.validation.js";

const router = Router();

// ---------- Public ----------

router.get(
  "/",
  validateQuery(listCategoriesQuerySchema),
  categoryController.list,
);

// Two segments, so this can never be shadowed by `/:id` below.
router.get(
  "/slug/:slug",
  validateParams(categorySlugParamSchema),
  categoryController.getBySlug,
);

router.get(
  "/:id",
  validateParams(categoryIdParamSchema),
  categoryController.getById,
);

// ---------- Authenticated ----------

router.post(
  "/",
  requireAuth,
  validateBody(createCategoryBodySchema),
  categoryController.create,
);

router.patch(
  "/:id",
  requireAuth,
  validateParams(categoryIdParamSchema),
  validateBody(updateCategoryBodySchema),
  categoryController.update,
);

router.delete(
  "/:id",
  requireAuth,
  validateParams(categoryIdParamSchema),
  categoryController.remove,
);

export default router;
