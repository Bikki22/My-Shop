import { randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";
import { Order, type OrderDocument } from "../orders/order.model.js";
import { orderService } from "../orders/order.service.js";
import type { IUserDocument, UserRole } from "../users/user.model.js";
import {
  buildEsewaForm,
  esewaConfig,
  fetchEsewaStatus,
  isCallbackSignatureValid,
  parseEsewaAmount,
  type EsewaCallbackPayload,
  type EsewaConfig,
  type EsewaFormFields,
  type EsewaStatus,
} from "./esewa.client.js";
import {
  Payment,
  type PaymentDocument,
  type PaymentState,
} from "./payment.model.js";
import { esewaCallbackPayloadSchema } from "./payment.validation.js";

/** Cents of tolerance when comparing our figure with the gateway's. */
const AMOUNT_EPSILON = 0.01;

/** How many open attempts one reconciliation sweep will look at. */
const RECONCILE_BATCH = 50;

/** What a caller needs to send the customer to eSewa. */
export interface EsewaCheckoutForm {
  /** POST the fields here as a real form submit, not with fetch. */
  formUrl: string;
  fields: EsewaFormFields;
  transactionUuid: string;
  paymentId: string;
}

export interface PaymentOutcome {
  payment: PaymentDocument;
  order: OrderDocument;
  /** Where the browser should end up. */
  result: "success" | "pending" | "failed";
}

/**
 * eSewa ePay v2.
 *
 * The rule this module is built around: **the browser never decides
 * whether a payment happened.** A redirect is only a prompt to go and ask
 * eSewa's status API, and only that API's answer moves money in our
 * records. Everything else here — the signature check, the amount check,
 * the guarded writes — exists to make a replayed, forged or interrupted
 * redirect harmless.
 */
export class PaymentService {
  private static readonly PRIVILEGED_ROLES: readonly UserRole[] = [
    "ADMIN",
    "SUPER_ADMIN",
  ];

  // ---------- Queries ----------

  /** The attempts made against one order, newest first. */
  async listForOrder(
    orderId: string,
    user: IUserDocument,
  ): Promise<PaymentDocument[]> {
    // Reuses the order module's ownership rule rather than restating it.
    const order = await orderService.getOrderForUser(orderId, user);
    return Payment.find({ order: order._id }).sort({ createdAt: -1 });
  }

  // ---------- Commands ----------

  /**
   * Opens a payment attempt and returns the signed form for it.
   *
   * A fresh `transaction_uuid` per attempt is what lets a customer who
   * abandoned the eSewa page simply try again: the old attempt stays open
   * and is settled or written off by reconciliation, and the new one is a
   * distinct transaction as far as the gateway is concerned.
   */
  async initiateEsewa(
    user: IUserDocument,
    orderId: string,
  ): Promise<EsewaCheckoutForm> {
    const config = esewaConfig();
    const order = await orderService.getOrderForUser(orderId, user);

    if (order.paymentMethod !== "ESEWA") {
      throw ApiError.badRequest("This order is not set to be paid with eSewa");
    }
    if (order.status === "CANCELLED") {
      throw ApiError.conflict("This order has been cancelled");
    }
    if (order.paymentStatus === "PAID") {
      throw ApiError.conflict("This order has already been paid");
    }
    if (order.paymentStatus === "REFUNDED") {
      throw ApiError.conflict("This order has been refunded");
    }

    const transactionUuid = PaymentService.nextTransactionUuid(
      order.orderNumber,
    );

    const payment = await Payment.create({
      order: order._id,
      user: order.user,
      provider: "ESEWA",
      transactionUuid,
      amount: order.pricing.grandTotal,
      state: "INITIATED",
    });

    const { pricing } = order;

    const { formUrl, fields } = buildEsewaForm(
      {
        transactionUuid,
        // eSewa requires the parts to add up to `total_amount`, and our
        // discount is a reduction on the goods — so it comes off `amount`
        // rather than travelling as a field eSewa has no slot for.
        amount: pricing.subtotal - pricing.discountTotal,
        taxAmount: pricing.taxTotal,
        deliveryCharge: pricing.shippingFee,
        serviceCharge: 0,
        total: pricing.grandTotal,
      },
      config,
      {
        // eSewa redirects the *browser* here, so these point at this API,
        // not at the SPA: the SPA cannot be trusted to report its own
        // payment result, and the callback has to be verified server-side
        // before anything is marked paid.
        successUrl: `${env.SERVER_URL}/api/v1/payments/esewa/success`,
        failureUrl: `${env.SERVER_URL}/api/v1/payments/esewa/failure?transaction_uuid=${transactionUuid}`,
      },
    );

    return {
      formUrl,
      fields,
      transactionUuid,
      paymentId: payment._id.toString(),
    };
  }

  /**
   * Handles eSewa's success redirect.
   *
   * The signature is verified first — it costs nothing and tells a forged
   * callback apart from a real one — but a valid signature still only
   * earns the right to *ask* eSewa what happened.
   */
  async settleFromCallback(encoded: string): Promise<PaymentOutcome> {
    const config = esewaConfig();
    const payload = PaymentService.decodeCallback(encoded);

    if (!isCallbackSignatureValid(payload, config)) {
      // Either a forgery or a secret/environment mismatch. Both are worth
      // seeing in the logs; neither is worth explaining to the client.
      console.error(
        `eSewa callback signature rejected for ${payload.transaction_uuid}`,
      );
      throw ApiError.badRequest("This payment confirmation is not valid");
    }

    if (payload.product_code !== config.productCode) {
      throw ApiError.badRequest("This payment belongs to another merchant");
    }

    const payment = await PaymentService.loadByUuid(payload.transaction_uuid);

    return this.reconcilePayment(payment, payload);
  }

  /**
   * Handles the failure redirect — which eSewa does *not* sign.
   *
   * So it is treated as a hint, never as proof: the status API is still
   * asked, because a customer who paid and then hit a network hiccup on
   * the way back must not have their order written off.
   */
  async handleFailure(transactionUuid: string): Promise<PaymentOutcome> {
    const payment = await PaymentService.loadByUuid(transactionUuid);
    return this.reconcilePayment(payment);
  }

  /**
   * Re-asks eSewa about one attempt. Safe to call repeatedly — this is the
   * recovery path for every way a redirect can go missing.
   */
  async reconcileByUuid(
    transactionUuid: string,
    user: IUserDocument,
  ): Promise<PaymentOutcome> {
    const payment = await PaymentService.loadByUuid(transactionUuid);

    if (
      !payment.user.equals(user._id) &&
      !PaymentService.PRIVILEGED_ROLES.includes(user.role)
    ) {
      // Same reasoning as orders: a 403 would confirm the reference exists.
      throw ApiError.notFound("Payment not found");
    }

    return this.reconcilePayment(payment);
  }

  /**
   * Sweeps the attempts that never came back — the browser was closed, the
   * phone died, the redirect was lost. Intended for a scheduled job or an
   * admin button.
   */
  async reconcileOpen(): Promise<{ checked: number; settled: number }> {
    const open = await Payment.find({ state: { $in: ["INITIATED", "PENDING"] } })
      .sort({ createdAt: 1 })
      .limit(RECONCILE_BATCH);

    let settled = 0;

    for (const payment of open) {
      try {
        const outcome = await this.reconcilePayment(payment);
        if (outcome.result === "success") settled += 1;
      } catch (error) {
        // One unreachable transaction must not abandon the rest of the
        // batch; the next sweep picks it up again.
        console.error(
          `Failed to reconcile payment ${payment.transactionUuid}`,
          error,
        );
      }
    }

    return { checked: open.length, settled };
  }

  // ---------- Internals ----------

  /**
   * The single place a payment's fate is decided: ask eSewa, check the
   * amount, then write.
   */
  private async reconcilePayment(
    payment: PaymentDocument,
    callback?: EsewaCallbackPayload,
  ): Promise<PaymentOutcome> {
    const config = esewaConfig();

    // Already settled: return what we have rather than paying eSewa a
    // status call for every refresh of the confirmation page.
    if (payment.state === "COMPLETE") {
      return {
        payment,
        order: await PaymentService.orderOf(payment),
        result: "success",
      };
    }

    const status = await fetchEsewaStatus(
      payment.transactionUuid,
      payment.amount,
      config,
    );

    if (status.status === "COMPLETE") {
      PaymentService.assertAmountMatches(payment, status.total_amount);
    }

    return this.apply(payment, status.status, status.ref_id, callback ?? status);
  }

  /** Maps eSewa's vocabulary onto ours, and writes both sides. */
  private async apply(
    payment: PaymentDocument,
    status: EsewaStatus,
    referenceId: string | null,
    raw: unknown,
  ): Promise<PaymentOutcome> {
    switch (status) {
      case "COMPLETE": {
        const settled = await PaymentService.transition(payment, {
          state: "COMPLETE",
          referenceId,
          providerStatus: status,
          failureReason: null,
          settledAt: new Date(),
          raw,
        });

        const order = await orderService.applyPaymentOutcome(
          settled.order,
          "PAID",
          `eSewa payment confirmed (${referenceId ?? settled.transactionUuid})`,
        );

        return { payment: settled, order, result: "success" };
      }

      case "PENDING":
      case "AMBIGUOUS": {
        // eSewa has the money in flight. Touching the order here would
        // either confirm a payment that may fail or write off one that may
        // succeed, so the attempt is parked for the next sweep instead.
        const parked = await PaymentService.transition(payment, {
          state: "PENDING",
          providerStatus: status,
          raw,
        });

        return {
          payment: parked,
          order: await PaymentService.orderOf(parked),
          result: "pending",
        };
      }

      case "FULL_REFUND":
      case "PARTIAL_REFUND": {
        const refunded = await PaymentService.transition(payment, {
          state: "REFUNDED",
          referenceId,
          providerStatus: status,
          raw,
        });

        const order = await orderService.applyPaymentOutcome(
          refunded.order,
          "REFUNDED",
          `eSewa reported a ${status === "FULL_REFUND" ? "full" : "partial"} refund`,
        );

        return { payment: refunded, order, result: "failed" };
      }

      case "CANCELED":
      case "NOT_FOUND":
      default: {
        const failed = await PaymentService.transition(payment, {
          state: status === "CANCELED" ? "CANCELED" : "FAILED",
          providerStatus: status,
          failureReason:
            status === "CANCELED"
              ? "Payment was cancelled at eSewa"
              : "eSewa has no record of this payment",
          raw,
        });

        const order = await PaymentService.orderOf(failed);

        // The order keeps its own payment state only if nothing else has
        // already succeeded for it — a customer's second attempt must not
        // mark an order unpaid because their first one lapsed.
        if (order.paymentStatus === "PENDING") {
          const updated = await orderService.applyPaymentOutcome(
            order._id,
            "FAILED",
            `eSewa payment ${status.toLowerCase()}`,
          );
          return { payment: failed, order: updated, result: "failed" };
        }

        return { payment: failed, order, result: "failed" };
      }
    }
  }

  /**
   * Guarded write: `state: { $ne: "COMPLETE" }` means a settled payment can
   * never be walked backwards by a late callback, and two callbacks racing
   * to settle the same attempt produce exactly one winner — which is what
   * keeps `applyPaymentOutcome` from being called twice for one charge.
   */
  private static async transition(
    payment: PaymentDocument,
    set: Partial<{
      state: PaymentState;
      referenceId: string | null;
      providerStatus: string | null;
      failureReason: string | null;
      settledAt: Date;
      raw: unknown;
    }>,
  ): Promise<PaymentDocument> {
    const updated = await Payment.findOneAndUpdate(
      { _id: payment._id, state: { $ne: "COMPLETE" } },
      { $set: set },
      { returnDocument: "after", runValidators: true },
    );

    // Null means another request settled it first; its result stands.
    return updated ?? (await PaymentService.loadByUuid(payment.transactionUuid));
  }

  /**
   * A gateway reporting a different figure than we asked for is either a
   * tampered form or a misconfigured merchant account. Neither is a
   * payment we can accept on the customer's behalf.
   */
  private static assertAmountMatches(
    payment: PaymentDocument,
    reported: number,
  ): void {
    if (Math.abs(reported - payment.amount) <= AMOUNT_EPSILON) return;

    console.error(
      `eSewa amount mismatch on ${payment.transactionUuid}: expected ${String(payment.amount)}, got ${String(reported)}`,
    );

    throw ApiError.conflict(
      "The amount eSewa confirmed does not match this order. Contact support before paying again.",
    );
  }

  private static decodeCallback(encoded: string): EsewaCallbackPayload {
    let decoded: unknown;
    try {
      decoded = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
    } catch {
      throw ApiError.badRequest("Unreadable eSewa response");
    }

    const parsed = esewaCallbackPayloadSchema.safeParse(decoded);
    if (!parsed.success) {
      throw ApiError.badRequest("Unexpected eSewa response");
    }

    return parsed.data;
  }

  private static async loadByUuid(
    transactionUuid: string,
  ): Promise<PaymentDocument> {
    const payment = await Payment.findOne({ transactionUuid });
    if (!payment) {
      throw ApiError.notFound("Payment not found");
    }
    return payment;
  }

  private static async orderOf(payment: PaymentDocument) {
    const order = await Order.findById(payment.order);
    if (!order) {
      // The order is created before the payment and never deleted, so this
      // is a data-integrity problem rather than a client mistake.
      throw new ApiError(500, "The order for this payment no longer exists");
    }
    return order;
  }

  /**
   * `ORD-20260901-K3F9QZ-9F2C41` — the order it belongs to, readable at a
   * glance in eSewa's merchant dashboard, plus random bytes so a retried
   * attempt is a new transaction. Stays inside eSewa's alphabet
   * (alphanumeric and hyphen).
   */
  private static nextTransactionUuid(orderNumber: string): string {
    return `${orderNumber}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }
}

export const paymentService = new PaymentService();
export type { EsewaConfig };
