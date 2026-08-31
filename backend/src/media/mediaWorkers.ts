import { Worker } from "bullmq";
import type { AppConfig } from "../config/env.js";
import { logger } from "../config/logger.js";
import type { StorageProvider } from "../storage/StorageProvider.js";
import {
  IMAGE_MEDIA_QUEUE,
  VIDEO_MEDIA_QUEUE,
  redisConnectionOptions,
  type MediaJobData,
} from "./mediaQueue.js";
import { processMedia } from "./mediaProcessor.js";

export type MediaWorkers = Readonly<{ close: () => Promise<void> }>;

export async function createMediaWorkers(
  config: AppConfig,
  storageProvider: StorageProvider,
): Promise<MediaWorkers> {
  const connection = redisConnectionOptions(config.redisUrl);
  const images = new Worker<MediaJobData>(
    IMAGE_MEDIA_QUEUE,
    async (job) => processMedia(
      job.data.mediaId,
      storageProvider,
      config,
      job.attemptsMade + 1 < (job.opts.attempts ?? 1),
    ),
    { connection, concurrency: config.imageWorkerConcurrency },
  );
  const videos = new Worker<MediaJobData>(
    VIDEO_MEDIA_QUEUE,
    async (job) => processMedia(
      job.data.mediaId,
      storageProvider,
      config,
      job.attemptsMade + 1 < (job.opts.attempts ?? 1),
    ),
    { connection, concurrency: config.videoWorkerConcurrency },
  );
  for (const worker of [images, videos]) {
    worker.on("failed", (job, error) => {
      logger.error({ mediaId: job?.data.mediaId, error }, "Media optimization job failed");
    });
    worker.on("error", (error) => logger.error({ error }, "Media worker connection error"));
  }
  await Promise.all([images.waitUntilReady(), videos.waitUntilReady()]);
  return { close: async () => void (await Promise.all([images.close(), videos.close()])) };
}
