import "dotenv/config";
import { createServer } from "node:http";
import { createApplication } from "./app/index.js";

async function main() {
  try {
    const server = createServer(createApplication());
    const PORT = Number(process.env.PORT) ?? 8000;

    server.listen(PORT, () => {
      console.log(`Http server is running in PORT ${PORT}`);
    });
  } catch (error) {
    console.log(`Error starting HTTP server`);
    throw error;
  }
}

main();
