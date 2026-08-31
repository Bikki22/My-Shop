import mongoose from "mongoose";
import { env } from "./env.js";

/**
 * Connects to MongoDB and *fails loudly* if it can't.
 *
 * Swallowing the error here would let the HTTP server come up against no
 * database: Mongoose would buffer every query and each request would hang
 * until it timed out, which looks like a bug in the route rather than a
 * missing connection.
 */
export const connectDatabase = async (): Promise<void> => {
  // Reject unknown keys in filters/updates instead of silently ignoring them.
  mongoose.set("strictQuery", true);

  await mongoose.connect(env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10_000,
  });

  console.log("📦 MongoDB connected");
};

export const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log("📦 MongoDB disconnected");
};
