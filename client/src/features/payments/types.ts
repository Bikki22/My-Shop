/**
 * Mirrors `EsewaCheckoutForm` from the server's
 * `modules/payments/payment.service.ts`.
 *
 * The rule the payments module is built around: **the browser never decides
 * whether a payment happened.** These fields are signed server-side and
 * simply carried to eSewa; whether money moved is settled by the server
 * asking eSewa's status API when the shopper is redirected back.
 */
export interface EsewaCheckoutForm {
  /** POST the fields here as a real form submit, not with `fetch`. */
  formUrl: string;
  fields: Record<string, string>;
  transactionUuid: string;
  paymentId: string;
}
