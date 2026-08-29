import "dotenv/config";

import { clerkMiddleware } from "@clerk/express";
import express from "express";
import type { Express } from "express";
import helmet from "helmet";

// routes
import userRoutes from "./modules/users/user.routes.js";
import { clerkWebhookHandler } from "./webhooks/clerk.js";

export function createApplication(): Express {
  const app = express();

  app.post(
    "/webhooks/clerk",
    express.raw({ type: "application/json" }),
    clerkWebhookHandler,
  );

  app.use(helmet());
  app.use(clerkMiddleware());
  app.use(express.json());

  app.get("/", (req, res) => {
    return res.json({ message: "hello world" });
  });

  app.use("/api/v1/user", userRoutes);

  return app;
}
