import { Queue, type ConnectionOptions, type JobsOptions } from "bullmq";
import type { MediaKind } from "@maglive/contracts";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../errors/AppError.js";

export const IMAGE_MEDIA_QUEUE = "media-images";
export const VIDEO_MEDIA_QUEUE = "media-videos";

export type MediaJobData = Readonly<{
  mediaId: string;
  kind: "image" | "video";
}>;

export interface MediaJobQueue {
  enqueue(mediaId: string, kind: MediaKind): Promise<string>;
  retry(mediaId: string, kind: MediaKind): Promise<string>;
  close(): Promise<void>;
}

export function redisConnectionOptions(
  redisUrl: string,
  purpose: "producer" | "worker" = "worker",
): ConnectionOptions {
  const parsed = new URL(redisUrl);
  const database = parsed.pathname.replace(/^\//, "");
  return {
    host: parsed.hostname,
    port: parsed.port === "" ? 6379 : Number.parseInt(parsed.port, 10),
    ...(parsed.username === ""
      ? {}
      : { username: decodeURIComponent(parsed.username) }),
    ...(parsed.password === ""
      ? {}
      : { password: decodeURIComponent(parsed.password) }),
    ...(database === "" ? {} : { db: Number.parseInt(database, 10) }),
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
    // Workers use blocking Redis commands and BullMQ requires unlimited
    // retries for those connections. API producers must fail immediately
    // while Redis is offline; otherwise an HTTP upload can remain open at
    // 100% forever while ioredis keeps the command in its offline queue.
    maxRetriesPerRequest: purpose === "worker" ? null : 1,
    enableOfflineQueue: purpose === "worker",
  };
}

export class BullMediaJobQueue implements MediaJobQueue {
  readonly images: Queue<MediaJobData>;
  readonly videos: Queue<MediaJobData>;
  readonly jobOptions: JobsOptions;

  constructor(config: AppConfig) {
    const connection = redisConnectionOptions(config.redisUrl, "producer");
    this.images = new Queue(IMAGE_MEDIA_QUEUE, { connection });
    this.videos = new Queue(VIDEO_MEDIA_QUEUE, { connection });
    this.jobOptions = {
      attempts: config.mediaJobAttempts,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60, count: 5_000 },
    };
  }

  private queue(kind: MediaKind): Queue<MediaJobData> {
    return kind === "image"
      ? this.images
      : kind === "video"
        ? this.videos
        : (() => {
            throw new AppError(
              422,
              "MEDIA_PROCESSING_UNSUPPORTED",
              "This media type does not require optimization.",
            );
          })();
  }

  async enqueue(mediaId: string, kind: MediaKind): Promise<string> {
    const job = await this.queue(kind).add(
      "optimize",
      { mediaId, kind: kind as "image" | "video" },
      { ...this.jobOptions, jobId: mediaId },
    );
    return job.id ?? mediaId;
  }

  async retry(mediaId: string, kind: MediaKind): Promise<string> {
    const queue = this.queue(kind);
    const previous = await queue.getJob(mediaId);
    if (previous !== undefined) {
      const state = await previous.getState();
      if (state === "failed") {
        await previous.retry();
        return previous.id ?? mediaId;
      }
      if (state === "waiting" || state === "active" || state === "delayed") {
        return previous.id ?? mediaId;
      }
      await previous.remove().catch(() => undefined);
    }
    return this.enqueue(mediaId, kind);
  }

  async close(): Promise<void> {
    await Promise.all([this.images.close(), this.videos.close()]);
  }
}
