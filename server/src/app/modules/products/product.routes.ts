import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";
import { productController } from "./product.controller.js";
import {
  categoryIdParamSchema,
  createProductBodySchema,
  getAllProductsQuerySchema,
  paginationQuerySchema,
  productIdParamSchema,
  removeProductSubImageBodySchema,
  updateProductBodySchema,
} from "./product.validation.js";

const router = Router();

// ---------- Public ----------

router.get(
  "/",
  validateQuery(getAllProductsQuerySchema),
  productController.getAll,
);

router.get(
  "/category/:categoryId",
  validateParams(categoryIdParamSchema),
  validateQuery(paginationQuerySchema),
  productController.getByCategory,
);

router.get(
  "/:id",
  validateParams(productIdParamSchema),
  productController.getById,
);

// ---------- Authenticated ----------

router.post(
  "/",
  requireAuth,
  validateBody(createProductBodySchema),
  productController.create,
);

router.patch(
  "/:id",
  requireAuth,
  validateParams(productIdParamSchema),
  validateBody(updateProductBodySchema),
  productController.update,
);

router.delete(
  "/:id",
  requireAuth,
  validateParams(productIdParamSchema),
  productController.remove,
);

router.patch(
  "/:id/images/remove",
  requireAuth,
  validateParams(productIdParamSchema),
  validateBody(removeProductSubImageBodySchema),
  productController.removeSubImage,
);

export default router;
