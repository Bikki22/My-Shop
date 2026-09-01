import "dotenv/config";

import { clerkMiddleware } from "@clerk/express";
import cors from "cors";
import express from "express";
import type { Express, NextFunction, Request, Response } from "express";
import helmet from "helmet";

import { corsOrigins, env, isProduction } from "./config/env.js";
// routes
import categoryRoutes from "./modules/category/category.routes.js";
import productRoutes from "./modules/products/product.routes.js";
import userRoutes from "./modules/users/user.routes.js";
import { ApiError } from "./utils/ApiError.js";
import { clerkWebhookHandler } from "./webhooks/clerk.js";

export function createApplication(): Express {
  const app = express();

  // Must stay ahead of express.json() — svix verifies the raw body, and a
  // parsed-then-restringified body produces a different signature.
  // `type: "*/*"` so a content-type we didn't predict still arrives raw
  // rather than as an empty object that fails verification confusingly.
  app.post(
    "/webhooks/clerk",
    express.raw({ type: "*/*" }),
    clerkWebhookHandler,
  );

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(clerkMiddleware());
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  app.get("/health", (_req, res) =>
    res.status(200).json({ success: true, status: "ok" }),
  );

  app.use("/api/v1/user", userRoutes);
  app.use("/api/v1/products", productRoutes);
  app.use("/api/v1/categories", categoryRoutes);

  // Unmatched routes: answer in the same JSON shape as every other error
  // instead of Express's default HTML 404, which breaks API clients.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
  });

  // Error handling is registered last: Express only searches for an error
  // handler *after* the layer that failed, so a handler declared above the
  // routes never runs for them.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json(err.toJSON());
    }

    // body-parser and friends throw `http-errors`, which mark client-safe
    // failures (e.g. malformed JSON) with `expose`. Those are 4xx, not bugs.
    const httpish = err as {
      status?: unknown;
      expose?: unknown;
      message?: unknown;
    };
    if (httpish?.expose === true && typeof httpish.status === "number") {
      return res.status(httpish.status).json({
        success: false,
        message:
          typeof httpish.message === "string" ? httpish.message : "Bad request",
      });
    }

    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      // Never leak internals in production; invaluable everywhere else.
      ...(isProduction
        ? {}
        : { stack: err instanceof Error ? err.stack : String(err) }),
    });
  });

  return app;
}
