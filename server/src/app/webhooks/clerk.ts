import type { Request, Response } from "express";
import { Webhook } from "svix";
import { env } from "../config/env.js";
import { User, type IUser } from "../modules/users/user.model.js";

/** The subset of Clerk's `user.*` payload this handler relies on. */
interface ClerkEmailAddress {
  id: string;
  email_address: string;
}

interface ClerkUserData {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  primary_email_address_id?: string | null;
  email_addresses?: ClerkEmailAddress[];
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserData;
}

const SVIX_HEADERS = ["svix-id", "svix-timestamp", "svix-signature"] as const;

const primaryEmailOf = (data: ClerkUserData): string | undefined => {
  const addresses = data.email_addresses ?? [];
  const primary = addresses.find(
    (address) => address.id === data.primary_email_address_id,
  )?.email_address;

  return primary ?? addresses[0]?.email_address;
};

/** Clerk sends `null` for cleared names; never write that over a required field. */
const trimmed = (value: string | null | undefined): string | undefined => {
  const result = value?.trim();
  return result ? result : undefined;
};

const handleUserUpserted = async (data: ClerkUserData): Promise<void> => {
  const email = primaryEmailOf(data);

  if (!email) {
    // Returning 2xx anyway: a retry can't add an email, so failing here
    // would just make Clerk redeliver this event forever.
    console.warn(
      `Clerk webhook: user ${data.id} has no email address, skipping`,
    );
    return;
  }

  const firstName = trimmed(data.first_name);
  const lastName = trimmed(data.last_name);

  const update: Partial<IUser> = {
    email,
    avatarUrl: data.image_url ?? null,
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
  };

  // Upsert rather than `create`: `requireAuth` provisions users lazily, so
  // by the time `user.created` arrives the record often already exists.
  // A plain insert would throw a duplicate-key error, return 500, and put
  // Clerk into an endless retry loop.
  await User.findOneAndUpdate(
    { clerkId: data.id },
    {
      $set: update,
      $setOnInsert: {
        clerkId: data.id,
        // `firstName` is required, so seed a placeholder only when Clerk
        // gave us nothing. Mongo rejects a field present in both operators,
        // and these two branches are mutually exclusive.
        ...(firstName ? {} : { firstName: "User" }),
      },
      // Clearing a last name in Clerk should clear it here too — a bare
      // `$set` of the present fields would leave the old value behind.
      ...(lastName ? {} : { $unset: { lastName: "" } }),
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
};

export const clerkWebhookHandler = async (req: Request, res: Response) => {
  if (!env.CLERK_WEBHOOK_SECRET) {
    console.error(
      "Clerk webhook received but CLERK_WEBHOOK_SECRET is not configured — rejecting.",
    );
    return res.status(503).json({
      success: false,
      message: "Webhook endpoint is not configured",
    });
  }

  // `express.raw` leaves a Buffer here. If some other body parser ran first
  // the signature can't be verified, and verifying a re-serialized body
  // would silently pass on a payload we never actually saw.
  if (!Buffer.isBuffer(req.body)) {
    console.error(
      "Clerk webhook: expected a raw body Buffer — check middleware order.",
    );
    return res
      .status(400)
      .json({ success: false, message: "Invalid webhook payload" });
  }

  const headers: Record<string, string> = {};
  for (const name of SVIX_HEADERS) {
    const value = req.headers[name];
    if (typeof value !== "string") {
      return res
        .status(400)
        .json({ success: false, message: `Missing ${name} header` });
    }
    headers[name] = value;
  }

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(env.CLERK_WEBHOOK_SECRET).verify(
      req.body.toString("utf8"),
      headers,
    ) as ClerkWebhookEvent;
  } catch {
    return res
      .status(400)
      .json({ success: false, message: "Invalid webhook signature" });
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated":
        await handleUserUpserted(event.data);
        break;

      case "user.deleted":
        await User.findOneAndUpdate(
          { clerkId: event.data.id },
          { $set: { status: "DELETED", deletedAt: new Date() } },
        );
        break;

      default:
        // Unsubscribed event types are acknowledged, not treated as errors.
        break;
    }
  } catch (error) {
    // 500 tells Clerk to retry, which is what we want for a transient
    // database failure. The handlers above are idempotent, so a redelivery
    // is safe.
    console.error(`Clerk webhook: failed to process ${event.type}`, error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to process webhook" });
  }

  return res.status(200).json({ received: true });
};
