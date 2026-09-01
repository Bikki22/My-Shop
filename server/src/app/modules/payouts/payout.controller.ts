import { asyncHandler } from "../../utils/async-handler.js";
import { currentUser } from "../../utils/current-user.js";
import { payoutService, PayoutService } from "./payout.service.js";
import type {
  CreatePayoutInput,
  ListMyPayoutsQuery,
  ListPayoutsQuery,
  MarkFailedInput,
  MarkPaidInput,
} from "./payout.validation.js";

/**
 * HTTP boundary only: unwrap the request, delegate, shape the response.
 * Bodies/params/queries are already validated by the route's middleware,
 * which is what makes the casts below safe.
 */
export class PayoutController {
  constructor(private readonly service: PayoutService) {}

  // ---------- Vendor ----------

  myBalance = asyncHandler(async (req, res) => {
    const balance = await this.service.getMyBalance(currentUser(req));
    return res.status(200).json({ success: true, data: balance });
  });

  listMine = asyncHandler(async (req, res) => {
    const result = await this.service.listMine(
      currentUser(req),
      req.validatedQuery as ListMyPayoutsQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  /** Readable by the shop it belongs to, and by admins. */
  getById = asyncHandler<{ id: string }>(async (req, res) => {
    const payout = await this.service.getById(currentUser(req), req.params.id);
    return res.status(200).json({ success: true, data: payout });
  });

  getBreakdown = asyncHandler<{ id: string }>(async (req, res) => {
    const result = await this.service.getBreakdown(
      currentUser(req),
      req.params.id,
    );
    return res.status(200).json({ success: true, ...result });
  });

  // ---------- Admin ----------

  list = asyncHandler(async (req, res) => {
    const result = await this.service.list(
      req.validatedQuery as ListPayoutsQuery,
    );
    return res.status(200).json({ success: true, ...result });
  });

  listPayable = asyncHandler(async (_req, res) => {
    const data = await this.service.listPayable();
    return res.status(200).json({ success: true, data });
  });

  balanceFor = asyncHandler<{ vendorId: string }>(async (req, res) => {
    const balance = await this.service.balanceFor(req.params.vendorId);
    return res.status(200).json({ success: true, data: balance });
  });

  create = asyncHandler(async (req, res) => {
    const payout = await this.service.create(
      currentUser(req),
      req.body as CreatePayoutInput,
    );
    return res.status(201).json({ success: true, data: payout });
  });

  markPaid = asyncHandler<{ id: string }>(async (req, res) => {
    const payout = await this.service.markPaid(
      currentUser(req),
      req.params.id,
      req.body as MarkPaidInput,
    );
    return res.status(200).json({ success: true, data: payout });
  });

  markFailed = asyncHandler<{ id: string }>(async (req, res) => {
    const payout = await this.service.markFailed(
      currentUser(req),
      req.params.id,
      req.body as MarkFailedInput,
    );
    return res.status(200).json({ success: true, data: payout });
  });
}

export const payoutController = new PayoutController(payoutService);
