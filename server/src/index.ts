import "dotenv/config";
import { createServer } from "node:http";
import { createApplication } from "./app/index.js";
import { connectDatabase, disconnectDatabase } from "./app/config/db.js";
import { env } from "./app/config/env.js";

async function main() {
  // The database must be up before we accept traffic, otherwise early
  // requests queue against a dead connection and time out.
  await connectDatabase();

  const server = createServer(createApplication());

  server.listen(env.PORT, () => {
    console.log(`🚀 HTTP server listening on port ${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received — shutting down`);
    server.close();
    try {
      await disconnectDatabase();
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error("Failed to start HTTP server:", error);
  process.exit(1);
});
