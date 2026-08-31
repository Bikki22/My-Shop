import "dotenv/config";

import { clerkMiddleware } from "@clerk/express";
import express from "express";
import type { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";

// routes
import productRoutes from "./modules/products/product.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import { ApiError } from "./utils/ApiError.js";
import { clerkWebhookHandler } from "./webhooks/clerk.js";

export function createApplication(): Express {
  const app = express();

  // Must stay ahead of express.json() — svix verifies the raw body.
  app.post(
    "/webhooks/clerk",
    express.raw({ type: "application/json" }),
    clerkWebhookHandler,
  );

  app.use(helmet());
  app.use(clerkMiddleware());
  app.use(express.json());

  app.get("/", (_req, res) => {
    return res.json({ message: "hello world" });
  });

  app.use("/api/v1/user", userRoutes);
  app.use("/api/v1/products", productRoutes);
  

  // Error handling is registered last: Express only searches for an error
  // handler *after* the layer that failed, so a handler declared above the
  // routes never runs for them.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json(err.toJSON());
    }

    // body-parser and friends throw `http-errors`, which mark client-safe
    // failures (e.g. malformed JSON) with `expose`. Those are 4xx, not bugs.
    const httpish = err as { status?: unknown; expose?: unknown; message?: unknown };
    if (httpish?.expose === true && typeof httpish.status === "number") {
      return res.status(httpish.status).json({
        success: false,
        message:
          typeof httpish.message === "string" ? httpish.message : "Bad request",
      });
    }

    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  });

  return app;
}
