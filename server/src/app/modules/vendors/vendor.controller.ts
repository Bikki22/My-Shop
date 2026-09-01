import { asyncHandler } from "../../utils/async-handler.js";
import { currentUser } from "../../utils/current-user.js";
import { vendorService, VendorService } from "./vendor.service.js";
import type {
  ApplyVendorInput,
  ListVendorsAdminQuery,
  ListVendorsQuery,
  RenameVendorInput,
  ReviewVendorInput,
  UpdateCommissionInput,
  UpdateMyVendorInput,
} from "./vendor.validation.js";

/**
 * HTTP boundary only: unwrap the request, delegate, shape the response.
 * Bodies/params/queries are already validated by the route's middleware,
 * which is what makes the casts below safe.
 */
export class VendorController {
  constructor(private readonly service: VendorService) {}

  // ---------- Public storefront ----------

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(
      req.validatedQuery as ListVendorsQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  getBySlug = asyncHandler<{ slug: string }>(async (req, res) => {
    const vendor = await this.service.getBySlug(req.params.slug);
    return res.status(200).json({ success: true, data: vendor });
  });

  getById = asyncHandler<{ id: string }>(async (req, res) => {
    const vendor = await this.service.getPublicById(req.params.id);
    return res.status(200).json({ success: true, data: vendor });
  });

  // ---------- Self-service ----------

  apply = asyncHandler(async (req, res) => {
    const vendor = await this.service.apply(
      currentUser(req),
      req.body as ApplyVendorInput,
    );
    return res.status(201).json({
      success: true,
      message: "Application submitted — an admin will review it shortly",
      data: vendor,
    });
  });

  getMine = asyncHandler(async (req, res) => {
    const vendor = await this.service.getMine(currentUser(req));
    return res.status(200).json({ success: true, data: vendor });
  });

  updateMine = asyncHandler(async (req, res) => {
    const vendor = await this.service.updateMine(
      currentUser(req),
      req.body as UpdateMyVendorInput,
    );
    return res.status(200).json({ success: true, data: vendor });
  });

  // ---------- Admin ----------

  adminList = asyncHandler(async (req, res) => {
    const result = await this.service.adminList(
      req.validatedQuery as ListVendorsAdminQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  adminGetById = asyncHandler<{ id: string }>(async (req, res) => {
    const vendor = await this.service.adminGetById(req.params.id);
    return res.status(200).json({ success: true, data: vendor });
  });

  review = asyncHandler<{ id: string }>(async (req, res) => {
    const vendor = await this.service.review(
      currentUser(req),
      req.params.id,
      req.body as ReviewVendorInput,
    );
    return res.status(200).json({ success: true, data: vendor });
  });

  updateCommission = asyncHandler<{ id: string }>(async (req, res) => {
    const vendor = await this.service.updateCommissionRate(
      req.params.id,
      req.body as UpdateCommissionInput,
    );
    return res.status(200).json({ success: true, data: vendor });
  });

  rename = asyncHandler<{ id: string }>(async (req, res) => {
    const vendor = await this.service.rename(
      req.params.id,
      req.body as RenameVendorInput,
    );
    return res.status(200).json({ success: true, data: vendor });
  });
}

export const vendorController = new VendorController(vendorService);
