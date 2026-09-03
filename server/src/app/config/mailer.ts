import { Resend } from "resend";

import { env } from "./env.js";

/**
 * The Resend client, built once at import.
 *
 * Optional like Cloudinary and eSewa: with no `RESEND_API_KEY` the client
 * is null and `utils/email.ts` logs what it would have sent instead. Email
 * is never on the critical path of a request — a placed order that could
 * not be acknowledged is still a placed order — so an unset key degrades
 * to silence rather than to an error.
 */
export const resend = env.RESEND_API_KEY
  ? new Resend(env.RESEND_API_KEY)
  : null;

export const isEmailConfigured = resend !== null;

/** The From header on every message. See `EMAIL_FROM` in `env.ts`. */
export const EMAIL_FROM = env.EMAIL_FROM;

if (!isEmailConfigured) {
  console.warn(
    "Resend is not configured — outgoing email will be logged instead of sent. " +
      "Set RESEND_API_KEY to enable it.",
  );
}
