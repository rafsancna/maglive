import { describe, expect, it } from "vitest";
import { redisConnectionOptions } from "../src/media/mediaQueue.js";

describe("media queue Redis connections", () => {
  it("keeps worker retries enabled for BullMQ blocking operations", () => {
    expect(
      redisConnectionOptions("redis://127.0.0.1:6379/2", "worker"),
    ).toMatchObject({
      host: "127.0.0.1",
      port: 6379,
      db: 2,
      maxRetriesPerRequest: null,
      enableOfflineQueue: true,
    });
  });

  it("fails producer commands instead of holding HTTP uploads open while Redis is offline", () => {
    expect(
      redisConnectionOptions("redis://127.0.0.1:6379", "producer"),
    ).toMatchObject({
      host: "127.0.0.1",
      port: 6379,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  });
});
