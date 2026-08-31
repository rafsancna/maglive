import { writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { optimizeVideo, type CommandRunner } from "../src/media/videoOptimizer.js";
import { LocalStorageProvider } from "../src/storage/LocalStorageProvider.js";
import { createTestConfig } from "./helpers/config.js";
import {
  createTemporaryUploadRoot,
  removeTemporaryUploadRoot,
} from "./helpers/temporaryUploadRoot.js";

let uploadRoot: string;

beforeEach(async () => {
  uploadRoot = await createTemporaryUploadRoot();
});

afterEach(async () => {
  await removeTemporaryUploadRoot(uploadRoot);
});

describe("video optimization", () => {
  it("creates bounded H.264 renditions, strips decorative audio, and generates a poster", async () => {
    const calls: Array<{ command: string; arguments_: string[] }> = [];
    const runner: CommandRunner = async (command, arguments_) => {
      calls.push({ command, arguments_ });
      if (command === "fake-ffprobe") {
        return JSON.stringify({
          streams: [
            { codec_type: "video", width: 3840, height: 2160, duration: "120" },
            { codec_type: "audio" },
          ],
          format: { duration: "120" },
        });
      }
      const outputPath = arguments_.at(-1);
      if (outputPath === undefined) throw new Error("Expected an output path.");
      if (path.extname(outputPath) === ".jpg") {
        await sharp({
          create: {
            width: 1_920,
            height: 1_080,
            channels: 3,
            background: { r: 18, g: 41, b: 32 },
          },
        }).jpeg().toFile(outputPath);
      } else {
        await writeFile(outputPath, Buffer.from("optimized-mp4"));
      }
      return "";
    };
    const config = createTestConfig({
      uploadRoot,
      ffmpegPath: "fake-ffmpeg",
      ffprobePath: "fake-ffprobe",
    });
    const provider = new LocalStorageProvider(uploadRoot, "http://localhost:5000/uploads");
    const report = vi.fn(async () => undefined);

    const result = await optimizeVideo(
      "private-source.mp4",
      provider,
      config,
      "remove",
      report,
      runner,
    );

    expect(result.variants.map((variant) => variant.height)).toEqual([720, 1080, 1440]);
    expect(result.variants.every((variant) => variant.codec === "h264")).toBe(true);
    expect(result.primary.height).toBe(1080);
    expect(result.durationSeconds).toBe(120);
    expect(result.generatedPoster).toMatchObject({ mimeType: "image/webp", codec: "webp" });
    const videoCalls = calls.filter(
      ({ command, arguments_ }) =>
        command === "fake-ffmpeg" && arguments_.at(-1)?.endsWith(".mp4"),
    );
    expect(videoCalls).toHaveLength(3);
    expect(videoCalls.every(({ arguments_ }) => arguments_.includes("-an"))).toBe(true);
    expect(videoCalls.every(({ arguments_ }) => arguments_.includes("+faststart"))).toBe(true);
    expect(report).toHaveBeenCalledWith("creating-720p", expect.any(Number));
    expect(report).toHaveBeenCalledWith("creating-1080p", expect.any(Number));
    expect(report).toHaveBeenCalledWith("creating-1440p", expect.any(Number));
    expect(report).toHaveBeenCalledWith("generating-poster", 82);
  });
});
