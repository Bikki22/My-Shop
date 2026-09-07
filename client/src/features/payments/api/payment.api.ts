import type { RequestOptions } from "@/lib/api";

/** Customer-facing paths on the server's `/api/v1/payments` router. */
export const paymentEndpoints = {
  esewaInitiate: "/payments/esewa/initiate",
  forOrder: (orderId: string) => `/payments/order/${orderId}`,
} as const;

type Request = { path: string } & RequestOptions;

/**
 * Asks the server for a signed eSewa checkout form for an order.
 *
 * The body carries only the order id — the amount is read from the stored
 * order and signed server-side, which is what stops a client paying Rs. 1
 * for a Rs. 6,000 basket.
 */
export const initiateEsewaRequest = (orderId: string): Request => ({
  path: paymentEndpoints.esewaInitiate,
  method: "POST",
  body: { orderId },
});
