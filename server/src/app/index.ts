import express from "express";
import type { Express } from "express";
import helmet from "helmet";

// routes
import authRoutes from "./modules/auth/auth.routes.js";

export function createApplication(): Express {
  const app = express();

  app.use(helmet());

  app.use(express.json());
  app.use();

  app.get("/", (req, res) => {
    return res.json({ message: "hello world" });
  });

  app.use("/api/v1/auth", authRoutes);

  return app;
}
