import "dotenv/config";

import type { Server } from "node:http";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { loadConfig } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createMongoSessionStore } from "./config/session.js";
import { createGracefulShutdown } from "./runtime/gracefulShutdown.js";

async function listen(app: ReturnType<typeof createApp>, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.once("error", reject);
  });
}

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  await connectDatabase(config.mongoUri);
  const sessionStore = createMongoSessionStore(config);
  const app = createApp({ config, sessionStore });
  const server = await listen(app, config.port);
  logger.info({ port: config.port }, "Maglive API is ready");

  const shutdown = createGracefulShutdown({
    server,
    disconnect: disconnectDatabase,
    logger
  });

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch(async (error: unknown) => {
  logger.fatal({ error }, "API startup failed");
  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
