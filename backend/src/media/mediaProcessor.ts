import type { MediaProcessingStage } from "@maglive/contracts";
import type { AppConfig } from "../config/env.js";
import { MediaModel, type MediaDocument } from "../models/Media.js";
import type { StorageProvider } from "../storage/StorageProvider.js";
import { optimizeImage } from "./imageOptimizer.js";
import { optimizeVideo } from "./videoOptimizer.js";

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Media optimization failed unexpectedly.";
  return message.replace(/[\r\n]+/g, " ").slice(0, 2_000);
}

async function progress(
  mediaId: string,
  stage: MediaProcessingStage,
  percentage: number,
): Promise<void> {
  await MediaModel.updateOne(
    { _id: mediaId, status: { $nin: ["ready", "deleting"] } },
    {
      $set: {
        status: "processing",
        processingStage: stage,
        progress: Math.max(0, Math.min(99, Math.round(percentage))),
      },
      $unset: { processingError: 1 },
      $inc: { version: 1 },
    },
  );
}

export async function processMedia(
  mediaId: string,
  storageProvider: StorageProvider,
  config: AppConfig,
  willRetry = false,
): Promise<void> {
  const media = await MediaModel.findById(mediaId).select("+sourceStorage");
  if (media === null || media.status === "ready" || media.status === "deleting") return;
  if (media.kind !== "image" && media.kind !== "video") {
    throw new Error("Only image and video media can be optimized.");
  }
  if (media.sourceStorage === undefined || media.sourceStorage.provider !== storageProvider.id) {
    throw new Error("The private source media is unavailable.");
  }
  await MediaModel.updateOne(
    { _id: mediaId },
    {
      $set: { status: "processing", processingStage: "analyzing", progress: 1 },
      $unset: { processingError: 1 },
      $inc: { processingAttempts: 1, version: 1 },
    },
  );
  if (storageProvider.materialize === undefined) {
    throw new Error("The storage provider cannot materialize private media for processing.");
  }
  const materialized = await storageProvider.materialize(media.sourceStorage.key);
  let produced: Awaited<ReturnType<typeof optimizeImage>> | undefined;
  try {
    const report = (stage: MediaProcessingStage, percentage: number) =>
      progress(mediaId, stage, percentage);
    const result =
      media.kind === "image"
        ? await optimizeImage(materialized.path, storageProvider, report)
        : await optimizeVideo(
            materialized.path,
            storageProvider,
            config,
            media.audioPolicy,
            report,
          );
    produced = result;
    await progress(mediaId, "finalizing", 95);
    await MediaModel.updateOne(
      { _id: mediaId, status: { $ne: "deleting" } },
      {
        $set: {
          storage: result.primary.storage,
          mimeType: result.primary.mimeType,
          sizeBytes: result.primary.sizeBytes,
          optimizedSizeBytes: result.primary.sizeBytes,
          width: result.width,
          height: result.height,
          variants: result.variants,
          ...(result.durationSeconds === undefined
            ? {}
            : { durationSeconds: result.durationSeconds }),
          ...(result.generatedPoster === undefined
            ? {}
            : { generatedPoster: result.generatedPoster }),
          status: "ready",
          processingStage: "ready",
          progress: 100,
        },
        $unset: { processingError: 1, processingJobId: 1, sourceStorage: 1 },
        $inc: { version: 1 },
      },
    );
    await storageProvider.delete(media.sourceStorage.key).catch(() => undefined);
  } catch (error) {
    if (produced !== undefined) {
      const keys = [
        ...produced.variants.map((variant) => variant.storage.key),
        produced.generatedPoster?.storage.key,
      ].filter((key): key is string => key !== undefined);
      await Promise.all(
        [...new Set(keys)].map((key) => storageProvider.delete(key).catch(() => undefined)),
      );
    }
    await MediaModel.updateOne(
      { _id: mediaId, status: { $ne: "deleting" } },
      {
        $set: {
          status: willRetry ? "queued" : "failed",
          processingStage: willRetry ? "queued" : "failed",
          processingError: errorMessage(error),
        },
        $inc: { version: 1 },
      },
    );
    throw error;
  } finally {
    await materialized.cleanup();
  }
}

export async function cleanupExpiredMediaSources(
  storageProvider: StorageProvider,
  config: AppConfig,
  now = new Date(),
): Promise<number> {
  const cutoff = new Date(now.getTime() - config.mediaSourceRetentionMs);
  const stale = await MediaModel.find({
    sourceStorage: { $exists: true },
    status: "failed",
    updatedAt: { $lt: cutoff },
  }).select("+sourceStorage");
  let cleaned = 0;
  for (const media of stale as MediaDocument[]) {
    if (media.sourceStorage?.provider !== storageProvider.id) continue;
    await storageProvider.delete(media.sourceStorage.key).catch(() => undefined);
    await MediaModel.updateOne(
      { _id: media._id, status: "failed" },
      { $unset: { sourceStorage: 1 }, $inc: { version: 1 } },
    );
    cleaned += 1;
  }
  return cleaned;
}
