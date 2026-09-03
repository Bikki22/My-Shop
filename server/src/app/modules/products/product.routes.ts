import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../../middlewares/validate.middleware.js";
import { uploadImages } from "../../middlewares/upload.middleware.js";
import { productController } from "./product.controller.js";
import {
  categoryIdParamSchema,
  createProductBodySchema,
  getAllProductsQuerySchema,
  paginationQuerySchema,
  productIdParamSchema,
  removeProductSubImageBodySchema,
  updateProductBodySchema,
  vendorSlugParamSchema,
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

/** A shop's storefront. Two segments, so `/:id` can never shadow it. */
router.get(
  "/shop/:slug",
  validateParams(vendorSlugParamSchema),
  validateQuery(getAllProductsQuerySchema),
  productController.getByVendorSlug,
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

/**
 * Multipart, not JSON — so no `validateBody` here. The upload middleware
 * enforces the file count, size and type, and the controller checks that
 * at least one file actually arrived.
 */
router.post(
  "/:id/images",
  requireAuth,
  validateParams(productIdParamSchema),
  uploadImages,
  productController.addImages,
);

router.patch(
  "/:id/images/remove",
  requireAuth,
  validateParams(productIdParamSchema),
  validateBody(removeProductSubImageBodySchema),
  productController.removeSubImage,
);

export default router;
