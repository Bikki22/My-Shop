import type { Request } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { IUserDocument } from "../users/user.model.js";
import { productService, ProductService } from "./product.services.js";
import type {
  CreateProductInput,
  GetAllProductsQuery,
  PaginationQuery,
  RemoveSubImageInput,
  UpdateProductInput,
} from "./product.validation.js";

/**
 * `requireAuth` guarantees this, but the type system can't see across
 * middleware — this turns the invariant into a real check instead of a `!`.
 */
const currentUser = (req: Request): IUserDocument => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  return req.user;
};

/**
 * HTTP boundary only: unwrap the request, delegate, shape the response.
 * Bodies/params/queries are already validated by the route's middleware,
 * which is what makes the casts below safe.
 */
export class ProductController {
  constructor(private readonly service: ProductService) {}

  getAll = asyncHandler(async (req, res) => {
    const result = await this.service.getAll(
      req.validatedQuery as GetAllProductsQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler<{ id: string }>(async (req, res) => {
    const product = await this.service.getById(req.params.id);
    return res.status(200).json({ success: true, data: product });
  });

  getByCategory = asyncHandler<{ categoryId: string }>(async (req, res) => {
    const { page, limit } = req.validatedQuery as PaginationQuery;
    const result = await this.service.getByCategory(req.params.categoryId, {
      page,
      limit,
    });
    return res.status(200).json({ success: true, ...result });
  });

  create = asyncHandler(async (req, res) => {
    const product = await this.service.create(
      req.body as CreateProductInput,
      currentUser(req),
    );
    return res.status(201).json({ success: true, data: product });
  });

  update = asyncHandler<{ id: string }>(async (req, res) => {
    const product = await this.service.update(
      req.params.id,
      req.body as UpdateProductInput,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: product });
  });

  remove = asyncHandler<{ id: string }>(async (req, res) => {
    await this.service.remove(req.params.id, currentUser(req));
    return res.status(200).json({ success: true, message: "Product deleted" });
  });

  removeSubImage = asyncHandler<{ id: string }>(async (req, res) => {
    const { imageUrl } = req.body as RemoveSubImageInput;
    const product = await this.service.removeSubImage(
      req.params.id,
      imageUrl,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: product });
  });
}

export const productController = new ProductController(productService);
