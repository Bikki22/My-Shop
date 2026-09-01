import type { Request } from "express";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { IUserDocument } from "../users/user.model.js";
import { categoryService, CategoryService } from "./category.service.js";
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "./category.validation.js";

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
export class CategoryController {
  constructor(private readonly service: CategoryService) {}

  // ---------- Public ----------

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(
      req.validatedQuery as ListCategoriesQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getById = asyncHandler<{ id: string }>(async (req, res) => {
    const category = await this.service.getById(req.params.id);
    return res.status(200).json({ success: true, data: category });
  });

  getBySlug = asyncHandler<{ slug: string }>(async (req, res) => {
    const category = await this.service.getBySlug(req.params.slug);
    return res.status(200).json({ success: true, data: category });
  });

  // ---------- Authenticated ----------

  create = asyncHandler(async (req, res) => {
    const category = await this.service.create(
      req.body as CreateCategoryInput,
      currentUser(req),
    );
    return res.status(201).json({ success: true, data: category });
  });

  update = asyncHandler<{ id: string }>(async (req, res) => {
    const category = await this.service.update(
      req.params.id,
      req.body as UpdateCategoryInput,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: category });
  });

  remove = asyncHandler<{ id: string }>(async (req, res) => {
    await this.service.remove(req.params.id, currentUser(req));
    return res.status(200).json({ success: true, message: "Category deleted" });
  });
}

export const categoryController = new CategoryController(categoryService);
