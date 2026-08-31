import "dotenv/config";

import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { loadConfig } from "./config/env.js";
import { logger } from "./config/logger.js";
import { cleanupExpiredMediaSources } from "./media/mediaProcessor.js";
import { createMediaWorkers } from "./media/mediaWorkers.js";
import { assertVideoRuntime } from "./media/videoOptimizer.js";
import { LocalStorageProvider } from "./storage/LocalStorageProvider.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig(process.env);
  await assertVideoRuntime(config);
  await connectDatabase(config.mongoUri);
  const storageProvider = new LocalStorageProvider(config.uploadRoot, config.publicMediaBaseUrl);
  await cleanupExpiredMediaSources(storageProvider, config);
  const workers = await createMediaWorkers(config, storageProvider);
  const cleanupTimer = setInterval(() => {
    void cleanupExpiredMediaSources(storageProvider, config).catch((error: unknown) =>
      logger.error({ error }, "Expired media source cleanup failed"),
    );
  }, 60 * 60 * 1_000);
  cleanupTimer.unref();
  logger.info(
    { imageConcurrency: config.imageWorkerConcurrency, videoConcurrency: config.videoWorkerConcurrency },
    "Media optimization workers are ready",
  );
  let closing = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (closing) return;
    closing = true;
    clearInterval(cleanupTimer);
    logger.info({ signal }, "Media worker shutdown started");
    await workers.close();
    await disconnectDatabase();
    logger.info("Media worker shutdown completed");
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

bootstrap().catch(async (error: unknown) => {
  logger.fatal({ error }, "Media worker startup failed");
  await disconnectDatabase().catch(() => undefined);
  process.exitCode = 1;
});
