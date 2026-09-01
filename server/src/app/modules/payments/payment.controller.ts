import type { Request, Response } from "express";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { asyncHandler } from "../../utils/async-handler.js";
import type { IUserDocument } from "../users/user.model.js";
import { paymentService, PaymentService } from "./payment.service.js";
import type {
  EsewaCallbackQuery,
  EsewaFailureQuery,
  InitiatePaymentInput,
} from "./payment.validation.js";

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
 * The gateway redirects a *browser*, so those two handlers answer with a
 * 302 to the storefront rather than JSON — an API error page is not a
 * thing a customer coming back from eSewa should ever see.
 */
const redirectToClient = (
  res: Response,
  result: string,
  params: Record<string, string> = {},
): void => {
  const url = new URL("/payment/result", env.CLIENT_URL);
  url.searchParams.set("status", result);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  res.redirect(302, url.toString());
};

export class PaymentController {
  constructor(private readonly service: PaymentService) {}

  // ---------- Customer (API) ----------

  /**
   * Returns the signed form. The client renders it as a hidden form and
   * submits it — a `fetch` would fetch eSewa's page instead of navigating
   * the customer to it, which is the single most common way this
   * integration is got wrong.
   */
  initiateEsewa = asyncHandler(async (req, res) => {
    const { orderId } = req.body as InitiatePaymentInput;
    const form = await this.service.initiateEsewa(currentUser(req), orderId);
    return res.status(201).json({ success: true, data: form });
  });

  listForOrder = asyncHandler<{ orderId: string }>(async (req, res) => {
    const payments = await this.service.listForOrder(
      req.params.orderId,
      currentUser(req),
    );
    return res.status(200).json({ success: true, data: payments });
  });

  /** Manual recovery for a client that lost the redirect. */
  reconcile = asyncHandler<{ transactionUuid: string }>(async (req, res) => {
    const outcome = await this.service.reconcileByUuid(
      req.params.transactionUuid,
      currentUser(req),
    );
    return res.status(200).json({
      success: true,
      data: {
        result: outcome.result,
        payment: outcome.payment,
        order: outcome.order,
      },
    });
  });

  // ---------- Gateway redirects (public) ----------

  /**
   * eSewa's success redirect.
   *
   * Deliberately unauthenticated: the request arrives from eSewa's domain,
   * so the session cookie is not reliably sent. The signed payload plus
   * the server-side status check are what establish trust here — not the
   * caller's identity.
   */
  esewaSuccess = asyncHandler(async (req, res) => {
    const { data } = req.validatedQuery as EsewaCallbackQuery;

    try {
      const outcome = await this.service.settleFromCallback(data);
      return redirectToClient(res, outcome.result, {
        order: outcome.order._id.toString(),
        orderNumber: outcome.order.orderNumber,
      });
    } catch (error) {
      // Never bounce the customer into a JSON error page: log it, then
      // land them somewhere that can explain itself and offer a retry.
      console.error("eSewa success callback failed", error);
      return redirectToClient(res, "failed", {
        reason:
          error instanceof ApiError ? error.message : "Payment verification failed",
      });
    }
  });

  /** eSewa's failure redirect — unsigned, so it is only a hint. */
  esewaFailure = asyncHandler(async (req, res) => {
    const query = req.validatedQuery as EsewaFailureQuery;

    if (!query.transaction_uuid) {
      return redirectToClient(res, "failed");
    }

    try {
      const outcome = await this.service.handleFailure(query.transaction_uuid);
      return redirectToClient(res, outcome.result, {
        order: outcome.order._id.toString(),
        orderNumber: outcome.order.orderNumber,
      });
    } catch (error) {
      console.error("eSewa failure callback could not be reconciled", error);
      return redirectToClient(res, "failed");
    }
  });

  // ---------- Admin ----------

  /** Settles the attempts whose redirect never came back. */
  reconcileOpen = asyncHandler(async (_req, res) => {
    const result = await this.service.reconcileOpen();
    return res.status(200).json({ success: true, data: result });
  });
}

export const paymentController = new PaymentController(paymentService);
