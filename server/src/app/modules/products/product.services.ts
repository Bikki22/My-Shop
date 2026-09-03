import mongoose, { Types } from "mongoose";
import { CLOUDINARY_FOLDERS, PRODUCT_IMAGES } from "../../constants.js";
import { ApiError } from "../../utils/ApiError.js";
import {
  destroyImageByUrl,
  destroyImages,
  uploadImages,
} from "../../utils/cloudinary.js";
import type { IUserDocument, UserRole } from "../users/user.model.js";
import { vendorService, VendorService } from "../vendors/vendor.service.js";
import type { IProduct, ProductDocument } from "./product.model.js";
import {
  productRepository,
  ProductRepository,
  type PageRequest,
  type SortStage,
  type UpdateProductData,
} from "./product.repository.js";
import type {
  CreateProductInput,
  GetAllProductsQuery,
  UpdateProductInput,
} from "./product.validation.js";

/** Drops keys explicitly set to `undefined` so they never reach `$set`. */
const omitUndefined = <T extends object>(
  value: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } =>
  Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as { [K in keyof T]?: Exclude<T[K], undefined> };

export class ProductService {
  private static readonly PRIVILEGED_ROLES: readonly UserRole[] = [
    "ADMIN",
    "SUPER_ADMIN",
  ];

  private static readonly SORT_STAGES: Record<
    GetAllProductsQuery["sort"],
    SortStage
  > = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
  };

  constructor(private readonly repository: ProductRepository) {}

  // ---------- Queries ----------

  async getById(id: string): Promise<ProductDocument> {
    const product = await this.repository.findById(id);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    return product;
  }

  getAll(query: GetAllProductsQuery) {
    const { page, limit, sort } = query;
    return this.repository.findAll(
      ProductService.buildFilter(query),
      ProductService.SORT_STAGES[sort],
      { page, limit },
    );
  }

  getByCategory(categoryId: string, page: PageRequest) {
    return this.repository.findByCategory(categoryId, page);
  }

  /**
   * A shop's storefront, addressed by its public slug.
   *
   * Resolving the slug through the vendor service rather than joining here
   * is what keeps a suspended shop's listings off the site: that lookup is
   * already scoped to approved shops, so an unapproved slug 404s before
   * any product is read.
   */
  async getByVendorSlug(slug: string, query: GetAllProductsQuery) {
    const vendor = await vendorService.getBySlug(slug);
    const { page, limit, sort } = query;

    return this.repository.findByVendor(
      vendor._id,
      ProductService.SORT_STAGES[sort],
      { page, limit },
    );
  }

  // ---------- Commands ----------

  /**
   * Lists a new product under the caller's shop.
   *
   * The vendor is resolved from the caller rather than accepted from the
   * body — a `vendorId` a client could send is a client choosing whose
   * shop to sell from, and whose bank account the money lands in.
   */
  async create(input: CreateProductInput, user: IUserDocument) {
    const vendor = await vendorService.requireSellingVendor(user);

    const product = await this.repository.create({
      ...input,
      categoryId: new Types.ObjectId(input.categoryId),
      owner: user._id,
      vendor: vendor._id,
    });

    await VendorService.adjustProductCount(vendor._id, 1);

    return product;
  }

  async update(id: string, input: UpdateProductInput, user: IUserDocument) {
    const product = await this.loadManageable(id, user);
    await ProductService.assertMaySell(user);

    return this.repository.updateById(
      product._id.toString(),
      ProductService.toUpdateData(input),
    );
  }

  /**
   * Soft-deletes the listing.
   *
   * Deliberately *not* gated on the shop being able to sell: a suspended
   * vendor taking its own listings down is exactly what we want it to do,
   * and blocking that would strand products on a storefront nobody can
   * fulfil from.
   */
  async remove(id: string, user: IUserDocument): Promise<void> {
    const product = await this.loadManageable(id, user);

    await this.repository.softDeleteById(product._id.toString());
    await VendorService.adjustProductCount(product.vendor, -1);
  }

  /**
   * Uploads new photos and appends them to the listing.
   *
   * The order matters: Cloudinary first, then the document. A save that
   * fails after the upload leaves orphaned assets, which the cleanup below
   * handles; doing it the other way round would leave the product pointing
   * at URLs that were never successfully stored — a broken image on the
   * storefront, which is the worse of the two failures.
   */
  async addImages(id: string, files: readonly Buffer[], user: IUserDocument) {
    const product = await this.loadManageable(id, user);
    await ProductService.assertMaySell(user);

    const remaining = PRODUCT_IMAGES.MAX_PER_PRODUCT - product.images.length;
    if (files.length > remaining) {
      throw ApiError.badRequest(
        remaining <= 0
          ? `This product already has the maximum of ${String(PRODUCT_IMAGES.MAX_PER_PRODUCT)} images. Remove one first.`
          : `You can add at most ${String(remaining)} more image(s) to this product.`,
      );
    }

    const uploaded = await uploadImages(files, CLOUDINARY_FOLDERS.PRODUCTS);

    try {
      product.images = [...product.images, ...uploaded.map((img) => img.url)];
      return await this.repository.save(product);
    } catch (error) {
      await destroyImages(uploaded.map((img) => img.publicId));
      throw error;
    }
  }

  async removeSubImage(id: string, imageUrl: string, user: IUserDocument) {
    const product = await this.loadManageable(id, user);
    await ProductService.assertMaySell(user);

    if (!product.images.includes(imageUrl)) {
      throw ApiError.notFound("Image not found on this product");
    }
    if (product.images.length <= PRODUCT_IMAGES.MIN_PER_PRODUCT) {
      throw ApiError.badRequest("Product must have at least one image");
    }

    product.images = product.images.filter((image) => image !== imageUrl);
    const saved = await this.repository.save(product);

    // Only after the document no longer references it — a destroy that
    // ran first and a save that then failed would leave the product
    // pointing at an asset that is already gone. `destroyImageByUrl` is
    // a no-op for images hosted somewhere other than our Cloudinary
    // account, and never throws.
    void destroyImageByUrl(imageUrl);

    return saved;
  }

  // ---------- Internals ----------

  /**
   * Loads a product and asserts the caller may mutate it.
   * Every write path goes through here, so the 404-then-403 ordering
   * (and the check itself) can't drift between them.
   */
  private async loadManageable(
    id: string,
    user: IUserDocument,
  ): Promise<ProductDocument> {
    const product = await this.repository.findByIdRaw(id);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    if (!ProductService.canManage(product, user)) {
      throw ApiError.forbidden("You don't own this product");
    }
    return product;
  }

  private static canManage(
    product: ProductDocument,
    user: IUserDocument,
  ): boolean {
    return (
      product.owner.equals(user._id) ||
      ProductService.PRIVILEGED_ROLES.includes(user.role)
    );
  }

  /**
   * Asserts the caller's shop is in good standing before it changes what
   * is on sale.
   *
   * Admins skip the check: they are moderating someone else's listing and
   * have no shop of their own to be approved.
   */
  private static async assertMaySell(user: IUserDocument): Promise<void> {
    if (ProductService.PRIVILEGED_ROLES.includes(user.role)) return;
    await vendorService.requireSellingVendor(user);
  }

  private static buildFilter(
    query: GetAllProductsQuery,
  ): mongoose.QueryFilter<IProduct> {
    const { search, minPrice, maxPrice, tags, vendor, categoryId } = query;
    const filter: mongoose.QueryFilter<IProduct> = {};

    if (search) {
      filter.$text = { $search: search };
    }

    if (vendor) {
      filter.vendor = new Types.ObjectId(vendor);
    }

    if (categoryId) {
      filter.categoryId = new Types.ObjectId(categoryId);
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {
        ...(minPrice !== undefined && { $gte: minPrice }),
        ...(maxPrice !== undefined && { $lte: maxPrice }),
      };
    }

    if (tags) {
      const values = tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
      if (values.length > 0) {
        filter.tags = { $in: values };
      }
    }

    return filter;
  }

  /** Maps validated input onto persistence types (ids become ObjectIds). */
  private static toUpdateData(input: UpdateProductInput): UpdateProductData {
    const { categoryId, ...rest } = input;
    const data: UpdateProductData = omitUndefined(rest);

    if (categoryId) {
      data.categoryId = new Types.ObjectId(categoryId);
    }

    return data;
  }
}

export const productService = new ProductService(productRepository);
