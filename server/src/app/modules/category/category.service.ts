import { Types, type QueryFilter } from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import { Product } from "../products/product.model.js";
import type { IUserDocument, UserRole } from "../users/user.model.js";
import {
  Category,
  type CategoryDocument,
  type ICategory,
} from "./category.model.js";
import type {
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "./category.validation.js";

/**
 * User-supplied text goes into a `$regex`, so it has to be escaped. An
 * unescaped search of `(((((((((a` is a catastrophic-backtracking DoS, and
 * `.*` lets a caller widen the filter beyond what they typed.
 */
const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Drops keys explicitly set to `undefined` so they never reach `$set`. */
const omitUndefined = <T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };

/** MongoServerError code for a unique-index violation. */
const DUPLICATE_KEY = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === DUPLICATE_KEY;

/**
 * Strips accents, then collapses everything that isn't a letter or digit
 * into single hyphens — the exact shape the model's `slug` regex accepts.
 */
const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export class CategoryService {
  private static readonly PRIVILEGED_ROLES: readonly UserRole[] = [
    "ADMIN",
    "SUPER_ADMIN",
  ];

  private static readonly SORT_STAGES: Record<
    ListCategoriesQuery["sort"],
    Record<string, 1 | -1>
  > = {
    name_asc: { name: 1 },
    name_desc: { name: -1 },
    newest: { createdAt: -1 },
  };

  /** Every read is scoped to this, so soft-deleted rows can't leak out. */
  private static readonly NOT_DELETED = { deletedAt: null } as const;

  // ---------- Queries ----------

  async list(query: ListCategoriesQuery) {
    const { page, limit, search, isActive, owner, sort } = query;

    const filter: QueryFilter<ICategory> = {
      ...CategoryService.NOT_DELETED,
      isActive,
    };
    if (owner) {
      filter.owner = new Types.ObjectId(owner);
    }
    if (search) {
      filter.name = new RegExp(escapeRegex(search), "i");
    }

    const [categories, total] = await Promise.all([
      Category.find(filter)
        .sort(CategoryService.SORT_STAGES[sort])
        .skip((page - 1) * limit)
        .limit(limit),
      Category.countDocuments(filter),
    ]);

    return {
      data: categories,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string): Promise<CategoryDocument> {
    // The routes validate this, but an unvalidated caller would otherwise
    // get a Mongoose CastError rendered as a 500 instead of a clean 404.
    if (!Types.ObjectId.isValid(id)) {
      throw ApiError.notFound("Category not found");
    }

    const category = await Category.findOne({
      _id: id,
      ...CategoryService.NOT_DELETED,
    });
    if (!category) {
      throw ApiError.notFound("Category not found");
    }
    return category;
  }

  async getBySlug(slug: string): Promise<CategoryDocument> {
    const category = await Category.findOne({
      slug,
      ...CategoryService.NOT_DELETED,
    });
    if (!category) {
      throw ApiError.notFound("Category not found");
    }
    return category;
  }

  // ---------- Commands ----------

  /**
   * Admins curate the shared catalogue (`owner: null`); everyone else gets
   * a category of their own. That keeps the global tree from being editable
   * by whoever happened to create an entry in it.
   */
  async create(
    input: CreateCategoryInput,
    user: IUserDocument,
  ): Promise<CategoryDocument> {
    const { image, ...rest } = input;
    const slug = CategoryService.resolveSlug(input.slug, input.name);
    const owner = CategoryService.isPrivileged(user) ? null : user._id;

    try {
      // `image` is spread conditionally rather than passed as `undefined`:
      // under `exactOptionalPropertyTypes` an explicit `undefined` is not
      // the same as an absent key, and it would also skip the schema default.
      return await Category.create({
        ...rest,
        ...(image !== undefined && { image }),
        slug,
        owner,
      });
    } catch (error) {
      throw CategoryService.rethrowDuplicate(error, slug);
    }
  }

  async update(
    id: string,
    input: UpdateCategoryInput,
    user: IUserDocument,
  ): Promise<CategoryDocument> {
    const category = await this.loadManageable(id, user);

    // A rename deliberately does *not* re-derive the slug: existing links
    // and `GET /slug/:slug` callers would break silently. Send `slug`
    // explicitly to change it.
    const data = omitUndefined(input);
    if (data.slug) {
      data.slug = CategoryService.resolveSlug(data.slug, data.slug);
    }

    Object.assign(category, data);

    try {
      return await category.save();
    } catch (error) {
      throw CategoryService.rethrowDuplicate(error, category.slug);
    }
  }

  /**
   * Soft-deletes an empty category.
   *
   * Products hold a required `categoryId`, so removing one that is still
   * referenced would leave those products pointing at a category no read
   * path can resolve — a 409 is far kinder than the silent dangling ref.
   */
  async remove(id: string, user: IUserDocument): Promise<void> {
    const category = await this.loadManageable(id, user);

    const inUse = await Product.countDocuments({
      categoryId: category._id,
      deletedAt: null,
    });
    if (inUse > 0) {
      throw ApiError.conflict(
        `Cannot delete a category that still has ${String(inUse)} product(s)`,
      );
    }

    category.deletedAt = new Date();
    await category.save();
  }

  // ---------- Internals ----------

  /**
   * Loads a category and asserts the caller may mutate it.
   * Every write path goes through here, so the 404-then-403 ordering
   * (and the check itself) can't drift between them.
   */
  private async loadManageable(
    id: string,
    user: IUserDocument,
  ): Promise<CategoryDocument> {
    const category = await this.getById(id);

    if (!CategoryService.canManage(category, user)) {
      throw ApiError.forbidden("You don't own this category");
    }
    return category;
  }

  /** Shared (`owner: null`) categories are admin-only by construction. */
  private static canManage(
    category: CategoryDocument,
    user: IUserDocument,
  ): boolean {
    if (CategoryService.isPrivileged(user)) return true;
    return category.owner?.equals(user._id) ?? false;
  }

  private static isPrivileged(user: IUserDocument): boolean {
    return CategoryService.PRIVILEGED_ROLES.includes(user.role);
  }

  /** Uses the supplied slug, else derives one from the name. */
  private static resolveSlug(slug: string | undefined, name: string): string {
    const resolved = slugify(slug ?? name);
    if (!resolved) {
      throw ApiError.badRequest(
        "Could not derive a slug from the name — provide one explicitly",
      );
    }
    return resolved;
  }

  /**
   * The `{ slug, owner }` unique index is what actually enforces
   * uniqueness (a find-then-insert would race); this just renders the
   * violation as a 409 instead of a 500.
   */
  private static rethrowDuplicate(error: unknown, slug: string): unknown {
    if (isDuplicateKeyError(error)) {
      return ApiError.conflict(`A category with the slug "${slug}" exists`);
    }
    return error;
  }
}

export const categoryService = new CategoryService();
