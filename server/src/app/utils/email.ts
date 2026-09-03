import { EMAIL_FROM, isEmailConfigured, resend } from "../config/mailer.js";
import { env } from "../config/env.js";

/**
 * Outgoing transactional email.
 *
 * The contract every function here keeps: **nothing throws**. Each returns
 * whether the message went out, and callers are free to ignore it. That is
 * deliberate — every message this app sends is an acknowledgement of
 * something that already happened, so failing the request because the
 * receipt bounced would report a successful order as an error and invite a
 * retry that charges the customer twice.
 *
 * The flip side is that a failure must never be silent: every path that
 * returns false logs why first.
 */

export interface EmailMessage {
  /** One address or several. Resend caps a single send at 50 recipients. */
  to: string | string[];
  subject: string;
  html: string;
  /**
   * Plain-text alternative. Worth supplying: a message with no text part
   * scores worse with spam filters, and some clients show nothing at all.
   * Falls back to a tag-stripped rendering of `html`.
   */
  text?: string;
  replyTo?: string;
}

/**
 * Good enough for a fallback text part: drop the parts that carry no words,
 * strip the remaining tags, and collapse the whitespace they leave behind.
 * Not a general-purpose HTML-to-text conversion, and not used on anything
 * but our own templates.
 */
const htmlToText = (html: string): string =>
  html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

/**
 * Sends one message. Resolves to whether it was accepted by Resend.
 *
 * "Accepted" is as far as this can see: Resend queues the message and
 * delivers it asynchronously, so a true here means it was handed over, not
 * that it reached an inbox. Delivery failures surface in Resend's own
 * dashboard or via its webhooks, not in this return value.
 */
export const sendEmail = async (message: EmailMessage): Promise<boolean> => {
  const recipients = Array.isArray(message.to) ? message.to : [message.to];

  if (!isEmailConfigured || !resend) {
    console.info(
      `[email] not configured — would have sent "${message.subject}" to ${recipients.join(", ")}`,
    );
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: recipients,
      subject: message.subject,
      html: message.html,
      text: message.text ?? htmlToText(message.html),
      ...(message.replyTo ? { replyTo: message.replyTo } : {}),
    });

    // The SDK reports failures in the result rather than by throwing, so
    // a missing `error` check would treat every rejection as a success.
    if (error) {
      console.error(
        `[email] Resend rejected "${message.subject}" for ${recipients.join(", ")}`,
        error,
      );
      return false;
    }

    console.info(
      `[email] sent "${message.subject}" to ${recipients.join(", ")} (${data?.id ?? "no id"})`,
    );
    return true;
  } catch (error) {
    // Network failure, DNS, timeout — the request never reached Resend.
    console.error(
      `[email] failed to send "${message.subject}" to ${recipients.join(", ")}`,
      error,
    );
    return false;
  }
};

/**
 * Fire-and-forget send, for the common case: a caller that wants the
 * message on its way but must not wait for it or fail because of it.
 *
 * Handing `sendEmail` to `void` directly would be enough today, since it
 * already swallows its own errors — this exists so that stays true by
 * construction rather than by the caller having checked.
 */
export const queueEmail = (message: EmailMessage): void => {
  void sendEmail(message).catch((error: unknown) => {
    console.error(`[email] unexpected failure sending "${message.subject}"`, error);
  });
};

// ---------- Templates ----------

/**
 * Escapes text interpolated into a template.
 *
 * Product names and addresses are user-supplied and land inside HTML we
 * mail out. Unescaped, a name containing markup would break the layout at
 * best and carry a payload into the recipient's client at worst.
 */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const money = (amount: number): string => `Rs. ${amount.toFixed(2)}`;

/**
 * One shell for every message, so they look like they come from the same
 * shop. Inline styles only, and a table for the frame: email clients strip
 * <style> blocks and have no reliable flexbox or grid.
 */
const layout = (heading: string, body: string): string => `
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:8px;padding:32px;">
      <tr><td>
        <h1 style="margin:0 0 16px;font-size:20px;color:#111111;">${escapeHtml(heading)}</h1>
        ${body}
        <p style="margin:32px 0 0;font-size:12px;color:#888888;">
          You are receiving this because you have an account at My Shop.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`.trim();

export interface OrderConfirmationLine {
  name: string;
  quantity: number;
  price: number;
}

/**
 * The receipt sent once a checkout completes.
 *
 * Takes primitives rather than an `OrderDocument` on purpose: it keeps the
 * templates testable without a database, and stops the mailer from
 * becoming a second place that knows the order schema.
 */
export const sendOrderConfirmationEmail = (params: {
  to: string;
  customerName: string;
  orderNumber: string;
  total: number;
  items: readonly OrderConfirmationLine[];
}): void => {
  const rows = params.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:#333333;">
          ${escapeHtml(item.name)} &times; ${String(item.quantity)}
        </td>
        <td align="right" style="padding:8px 0;font-size:14px;color:#333333;">
          ${money(item.price * item.quantity)}
        </td>
      </tr>`,
    )
    .join("");

  const html = layout(
    `Thanks for your order, ${params.customerName}`,
    `
    <p style="margin:0 0 20px;font-size:14px;color:#333333;">
      Order <strong>${escapeHtml(params.orderNumber)}</strong> is confirmed.
      We'll email you again as each shop ships its part.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eeeeee;">
      ${rows}
      <tr>
        <td style="padding:12px 0 0;border-top:1px solid #eeeeee;font-size:14px;font-weight:bold;color:#111111;">Total</td>
        <td align="right" style="padding:12px 0 0;border-top:1px solid #eeeeee;font-size:14px;font-weight:bold;color:#111111;">${money(params.total)}</td>
      </tr>
    </table>
    <p style="margin:24px 0 0;">
      <a href="${env.CLIENT_URL}/orders/${encodeURIComponent(params.orderNumber)}"
         style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;">
        View your order
      </a>
    </p>`,
  );

  queueEmail({
    to: params.to,
    subject: `Order ${params.orderNumber} confirmed`,
    html,
  });
};

/** Sent when a payment is captured against an order. */
export const sendPaymentReceivedEmail = (params: {
  to: string;
  orderNumber: string;
  amount: number;
  method: string;
}): void => {
  const html = layout(
    "Payment received",
    `
    <p style="margin:0 0 12px;font-size:14px;color:#333333;">
      We've received ${money(params.amount)} for order
      <strong>${escapeHtml(params.orderNumber)}</strong> via ${escapeHtml(params.method)}.
    </p>
    <p style="margin:0;font-size:14px;color:#333333;">
      Your order is now being prepared for dispatch.
    </p>`,
  );

  queueEmail({
    to: params.to,
    subject: `Payment received for order ${params.orderNumber}`,
    html,
  });
};
