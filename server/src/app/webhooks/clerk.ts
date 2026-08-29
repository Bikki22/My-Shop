// controllers/webhook.controller.ts
import type { Request, Response } from "express";
import { Webhook } from "svix";
import { User } from "../modules/users/user.model.js";

export const clerkWebhookHandler = async (req: Request, res: Response) => {
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET!);
  const svixHeaders = {
    "svix-id": req.headers["svix-id"] as string,
    "svix-timestamp": req.headers["svix-timestamp"] as string,
    "svix-signature": req.headers["svix-signature"] as string,
  };

  let evt: any;
  try {
    evt = wh.verify(req.body, svixHeaders); // req.body must be raw Buffer here
  } catch {
    return res
      .status(400)
      .json({ success: false, message: "Invalid webhook signature" });
  }

  const { type, data } = evt;

  switch (type) {
    case "user.created": {
      const email = data.email_addresses?.find(
        (e: any) => e.id === data.primary_email_address_id,
      )?.email_address;
      await User.create({
        clerkId: data.id,
        firstName: data.first_name || "User",
        lastName: data.last_name || undefined,
        email,
        avatarUrl: data.image_url ?? null,
      });
      break;
    }
    case "user.updated": {
      const email = data.email_addresses?.find(
        (e: any) => e.id === data.primary_email_address_id,
      )?.email_address;
      await User.findOneAndUpdate(
        { clerkId: data.id },
        {
          firstName: data.first_name,
          lastName: data.last_name,
          email,
          avatarUrl: data.image_url ?? null,
        },
      );
      break;
    }
    case "user.deleted": {
      await User.findOneAndUpdate(
        { clerkId: data.id },
        { status: "DELETED", deletedAt: new Date() },
      );
      break;
    }
  }

  return res.status(200).json({ received: true });
};
