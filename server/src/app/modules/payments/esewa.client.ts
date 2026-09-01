import { createHmac, timingSafeEqual } from "node:crypto";
import { env, isProduction } from "../../config/env.js";
import { ApiError } from "../../utils/ApiError.js";

/**
 * eSewa ePay v2.
 *
 * The integration is a signed browser form-post, not a server-to-server
 * charge: we hand the customer's browser a form, eSewa collects the money
 * on its own domain, and the browser comes back to `success_url` carrying
 * a signed payload. That shape is why everything here is about *signatures*
 * — the callback is the only thing the customer's browser brings back, and
 * a browser is not a trustworthy messenger.
 */

const ENDPOINTS = {
  test: {
    form: "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    status: "https://rc.esewa.com.np/api/epay/transaction/status/",
  },
  production: {
    form: "https://epay.esewa.com.np/api/epay/main/v2/form",
    // Not `epay.esewa.com.np` — the live status API sits on the bare
    // domain while the form does not. eSewa's docs are the authority here.
    status: "https://esewa.com.np/api/epay/transaction/status/",
  },
} as const;

/**
 * The fields eSewa signs, in the order the signature is built from. eSewa
 * fixes both the list and the order — changing either produces a signature
 * the gateway rejects.
 */
const SIGNED_FIELD_NAMES = "total_amount,transaction_uuid,product_code";

/** The status API is a redirect-recovery path; it must not hang a request. */
const STATUS_TIMEOUT_MS = 10_000;

/** Every state eSewa reports for a transaction. */
export type EsewaStatus =
  | "COMPLETE"
  | "PENDING"
  | "CANCELED"
  | "NOT_FOUND"
  | "AMBIGUOUS"
  | "FULL_REFUND"
  | "PARTIAL_REFUND";

export interface EsewaConfig {
  productCode: string;
  secretKey: string;
  formUrl: string;
  statusUrl: string;
}

/** The exact set of hidden inputs the client must POST to `formUrl`. */
export interface EsewaFormFields {
  amount: string;
  tax_amount: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  product_service_charge: string;
  product_delivery_charge: string;
  success_url: string;
  failure_url: string;
  signed_field_names: string;
  signature: string;
}

/** The decoded `data` query parameter eSewa redirects back with. */
export interface EsewaCallbackPayload {
  transaction_code: string;
  status: string;
  total_amount: string;
  transaction_uuid: string;
  product_code: string;
  signed_field_names: string;
  signature: string;
}

export interface EsewaStatusResponse {
  product_code: string;
  transaction_uuid: string;
  total_amount: number;
  status: EsewaStatus;
  ref_id: string | null;
}

export interface BuildFormInput {
  transactionUuid: string;
  /** Goods, net of any discount, so the parts still sum to `total`. */
  amount: number;
  taxAmount: number;
  deliveryCharge: number;
  serviceCharge: number;
  total: number;
}

/**
 * Money crosses the wire as a string and is signed as that same string, so
 * it is formatted exactly once, here. Formatting it twice — once for the
 * form and once for the signature — is the classic way to ship a gateway
 * integration that rejects every other payment.
 *
 * Whole rupees are sent without decimals because that is the form eSewa's
 * own examples sign (`total_amount=110`); a forced `110.00` risks the
 * gateway normalising the value and then disagreeing with our signature.
 * Fractional amounts keep their two decimals, which eSewa accepts.
 */
const amountField = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
};

/**
 * eSewa returns amounts with thousands separators (`1,050.0`), which
 * `Number()` turns into `NaN`. Strip them before comparing.
 */
export const parseEsewaAmount = (value: string | number): number =>
  typeof value === "number" ? value : Number(value.replace(/,/g, ""));

/**
 * Resolves the credentials, or explains what is missing.
 *
 * Read per request rather than cached at import time so an unconfigured
 * deployment fails on the payment routes alone instead of at boot — the
 * same trade-off `/webhooks/clerk` makes.
 */
export const esewaConfig = (): EsewaConfig => {
  const { ESEWA_PRODUCT_CODE, ESEWA_SECRET_KEY, ESEWA_ENV } = env;

  if (!ESEWA_PRODUCT_CODE || !ESEWA_SECRET_KEY) {
    throw new ApiError(
      503,
      "Online payment is not configured. Set ESEWA_PRODUCT_CODE and ESEWA_SECRET_KEY.",
    );
  }

  // The sandbox credentials are published in eSewa's docs, so a production
  // deployment still pointed at them would accept payments that never
  // existed. Refuse rather than take the order.
  if (isProduction && ESEWA_ENV === "test") {
    throw new ApiError(
      503,
      "Refusing to take live payments through the eSewa sandbox — set ESEWA_ENV=production.",
    );
  }

  const endpoints = ENDPOINTS[ESEWA_ENV];

  return {
    productCode: ESEWA_PRODUCT_CODE,
    secretKey: ESEWA_SECRET_KEY,
    formUrl: endpoints.form,
    statusUrl: endpoints.status,
  };
};

/**
 * HMAC-SHA256 over `field=value` pairs joined by commas, base64-encoded —
 * eSewa's scheme verbatim.
 */
const sign = (message: string, secretKey: string): string =>
  createHmac("sha256", secretKey).update(message, "utf8").digest("base64");

/** Builds the signature over whichever fields the payload says are signed. */
const messageFrom = (
  fieldNames: string,
  values: Record<string, string>,
): string =>
  fieldNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => `${name}=${values[name] ?? ""}`)
    .join(",");

/**
 * The hidden inputs for the checkout form. The client POSTs these to
 * `formUrl` (a real form submit — not fetch: the customer has to *land* on
 * eSewa's page).
 */
export const buildEsewaForm = (
  input: BuildFormInput,
  config: EsewaConfig,
  urls: { successUrl: string; failureUrl: string },
): { formUrl: string; fields: EsewaFormFields } => {
  const totalAmount = amountField(input.total);

  const signature = sign(
    messageFrom(SIGNED_FIELD_NAMES, {
      total_amount: totalAmount,
      transaction_uuid: input.transactionUuid,
      product_code: config.productCode,
    }),
    config.secretKey,
  );

  return {
    formUrl: config.formUrl,
    fields: {
      amount: amountField(input.amount),
      tax_amount: amountField(input.taxAmount),
      total_amount: totalAmount,
      transaction_uuid: input.transactionUuid,
      product_code: config.productCode,
      product_service_charge: amountField(input.serviceCharge),
      product_delivery_charge: amountField(input.deliveryCharge),
      success_url: urls.successUrl,
      failure_url: urls.failureUrl,
      signed_field_names: SIGNED_FIELD_NAMES,
      signature,
    },
  };
};

/**
 * Verifies the signature on a decoded callback.
 *
 * Compared with `timingSafeEqual`: a byte-by-byte `===` on a MAC leaks how
 * much of a forged signature was correct, which is enough to forge one an
 * attempt at a time. Length is checked first because `timingSafeEqual`
 * throws on mismatched buffers.
 */
export const isCallbackSignatureValid = (
  payload: EsewaCallbackPayload,
  config: EsewaConfig,
): boolean => {
  const expected = sign(
    messageFrom(payload.signed_field_names, {
      transaction_code: payload.transaction_code,
      status: payload.status,
      total_amount: payload.total_amount,
      transaction_uuid: payload.transaction_uuid,
      product_code: payload.product_code,
    }),
    config.secretKey,
  );

  const received = Buffer.from(payload.signature, "utf8");
  const computed = Buffer.from(expected, "utf8");

  return (
    received.length === computed.length && timingSafeEqual(received, computed)
  );
};

/**
 * Asks eSewa what actually happened.
 *
 * This is the authority, not the redirect: a browser can be closed
 * mid-payment, replayed from history, or never come back at all, so the
 * money is only ever recognised on the strength of this call.
 */
export const fetchEsewaStatus = async (
  transactionUuid: string,
  totalAmount: number,
  config: EsewaConfig,
): Promise<EsewaStatusResponse> => {
  const url = new URL(config.statusUrl);
  url.searchParams.set("product_code", config.productCode);
  url.searchParams.set("total_amount", amountField(totalAmount));
  url.searchParams.set("transaction_uuid", transactionUuid);

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
  } catch (error) {
    // Network failure, DNS, timeout — the payment's real state is unknown,
    // which is emphatically not the same as "failed".
    throw new ApiError(
      502,
      "Could not reach eSewa to confirm this payment. It will be reconciled shortly.",
      [{ field: "esewa", message: String(error) }],
    );
  }

  if (!response.ok) {
    throw new ApiError(
      502,
      `eSewa status check failed with HTTP ${String(response.status)}`,
    );
  }

  const body = (await response.json()) as Partial<EsewaStatusResponse>;

  if (!body.status) {
    throw new ApiError(502, "eSewa returned an unrecognised status response");
  }

  return {
    product_code: body.product_code ?? config.productCode,
    transaction_uuid: body.transaction_uuid ?? transactionUuid,
    total_amount: parseEsewaAmount(body.total_amount ?? 0),
    status: body.status,
    ref_id: body.ref_id ?? null,
  };
};
