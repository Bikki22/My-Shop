import { asyncHandler } from "../../utils/async-handler.js";
import { currentUser } from "../../utils/current-user.js";
import { adminService, AdminService } from "./admin.service.js";
import type { OverviewQuery, TimeseriesQuery } from "./admin.validation.js";

/**
 * HTTP boundary only: unwrap the request, delegate, shape the response.
 * Queries are already validated by the route's middleware, which is what
 * makes the casts below safe.
 */
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // ---------- Platform ----------

  overview = asyncHandler(async (req, res) => {
    const data = await this.service.overview(
      req.validatedQuery as OverviewQuery,
    );
    return res.status(200).json({ success: true, data });
  });

  revenue = asyncHandler(async (req, res) => {
    const data = await this.service.revenue(
      req.validatedQuery as TimeseriesQuery,
    );
    return res.status(200).json({ success: true, data });
  });

  // ---------- One shop, for the owner of that shop ----------

  myOverview = asyncHandler(async (req, res) => {
    const data = await this.service.myOverview(
      currentUser(req),
      req.validatedQuery as OverviewQuery,
    );
    return res.status(200).json({ success: true, data });
  });

  mySales = asyncHandler(async (req, res) => {
    const data = await this.service.mySales(
      currentUser(req),
      req.validatedQuery as TimeseriesQuery,
    );
    return res.status(200).json({ success: true, data });
  });
}

export const adminController = new AdminController(adminService);
