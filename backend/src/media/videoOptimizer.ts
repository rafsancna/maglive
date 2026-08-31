import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MediaProcessingStage } from "@maglive/contracts";
import sharp from "sharp";
import type { AppConfig } from "../config/env.js";
import type { MediaVariant } from "../models/Media.js";
import type { StorageProvider } from "../storage/StorageProvider.js";
import type { OptimizationProgress, OptimizedMediaResult } from "./imageOptimizer.js";

type VideoAnalysis = Readonly<{
  width: number;
  height: number;
  durationSeconds: number;
  hasAudio: boolean;
}>;

export type CommandRunner = (command: string, arguments_: string[]) => Promise<string>;

const run: CommandRunner = async (command, arguments_) => {
  return new Promise((resolve, reject) => {
    const process = spawn(command, arguments_, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const output: Buffer[] = [];
    const errors: Buffer[] = [];
    process.stdout.on("data", (chunk: Buffer) => output.push(chunk));
    process.stderr.on("data", (chunk: Buffer) => errors.push(chunk));
    process.once("error", reject);
    process.once("close", (code) => {
      if (code === 0) resolve(Buffer.concat(output).toString("utf8"));
      else reject(new Error(`${path.basename(command)} exited with code ${code}: ${Buffer.concat(errors).toString("utf8").slice(-2_000)}`));
    });
  });
};

export async function assertVideoRuntime(config: AppConfig): Promise<void> {
  await Promise.all([
    run(config.ffmpegPath, ["-version"]),
    run(config.ffprobePath, ["-version"]),
  ]);
}

function stageForHeight(height: number): MediaProcessingStage {
  return height === 720 || height === 1080 || height === 1440
    ? (`creating-${height}p` as MediaProcessingStage)
    : "creating-source";
}

export async function optimizeVideo(
  inputPath: string,
  storageProvider: StorageProvider,
  config: AppConfig,
  audioPolicy: "keep" | "remove",
  report: OptimizationProgress,
  runner: CommandRunner = run,
): Promise<OptimizedMediaResult> {
  await report("analyzing", 5);
  const analysis = await (async () => {
    const raw = await runner(config.ffprobePath, [
      "-v", "error", "-print_format", "json", "-show_streams", "-show_format", inputPath,
    ]);
    const parsed = JSON.parse(raw) as {
      streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
      format?: { duration?: string };
    };
    const video = parsed.streams?.find((stream) => stream.codec_type === "video");
    const width = video?.width;
    const height = video?.height;
    const durationSeconds = Number.parseFloat(video?.duration ?? parsed.format?.duration ?? "0");
    if (width === undefined || height === undefined || width < 2 || height < 2 || !Number.isFinite(durationSeconds)) {
      throw new Error("FFprobe could not determine valid video metadata.");
    }
    return {
      width,
      height,
      durationSeconds: Math.max(0, durationSeconds),
      hasAudio: parsed.streams?.some((stream) => stream.codec_type === "audio") ?? false,
    } satisfies VideoAnalysis;
  })();
  const boundedSourceHeight = Math.max(2, Math.floor(Math.min(analysis.height, 1440) / 2) * 2);
  const heights = [...new Set([
    ...[720, 1080, 1440].filter((height) => height <= analysis.height),
    boundedSourceHeight,
  ])].sort((left, right) => left - right);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "maglive-video-"));
  const variants: MediaVariant[] = [];
  let generatedPoster: MediaVariant | undefined;
  try {
    for (const [index, height] of heights.entries()) {
      await report(stageForHeight(height), 10 + Math.round((index / heights.length) * 68));
      const outputPath = path.join(temporaryDirectory, `${height}p.mp4`);
      const arguments_ = [
        "-y", "-nostdin", "-loglevel", "error", "-i", inputPath,
        "-map", "0:v:0",
        ...(audioPolicy === "remove" || !analysis.hasAudio ? ["-an"] : ["-map", "0:a:0?", "-c:a", "aac", "-b:a", "128k"]),
        "-vf", `scale=-2:${height}`,
        "-c:v", "libx264", "-preset", "medium", "-crf", "23",
        "-pix_fmt", "yuv420p", "-movflags", "+faststart", outputPath,
      ];
      await runner(config.ffmpegPath, arguments_);
      const stored = await storageProvider.save({ temporaryPath: outputPath, kind: "video", extension: "mp4" });
      variants.push({
        label: `${height}p`,
        storage: { provider: stored.provider, key: stored.key },
        mimeType: "video/mp4",
        sizeBytes: stored.sizeBytes,
        width: Math.max(2, Math.round((analysis.width / analysis.height) * height / 2) * 2),
        height,
        codec: "h264",
      });
    }

    await report("generating-poster", 82);
    const posterJpeg = path.join(temporaryDirectory, "poster.jpg");
    const posterWebp = path.join(temporaryDirectory, "poster.webp");
    const seek = Math.min(3, Math.max(0, analysis.durationSeconds * 0.1));
    await runner(config.ffmpegPath, [
      "-y", "-nostdin", "-loglevel", "error", "-ss", seek.toFixed(3), "-i", inputPath,
      "-frames:v", "1", "-vf", "scale=min(1920\\,iw):-2", "-q:v", "2", posterJpeg,
    ]);
    const posterMetadata = await sharp(posterJpeg).webp({ quality: 82, effort: 4 }).toFile(posterWebp);
    const posterStored = await storageProvider.save({ temporaryPath: posterWebp, kind: "image", extension: "webp" });
    generatedPoster = {
      label: "poster",
      storage: { provider: posterStored.provider, key: posterStored.key },
      mimeType: "image/webp",
      sizeBytes: posterStored.sizeBytes,
      ...(posterMetadata.width === undefined ? {} : { width: posterMetadata.width }),
      ...(posterMetadata.height === undefined ? {} : { height: posterMetadata.height }),
      codec: "webp",
    };

    const primary = [...variants].sort((left, right) => {
      const leftDistance = Math.abs((left.height ?? 0) - 1080);
      const rightDistance = Math.abs((right.height ?? 0) - 1080);
      return leftDistance - rightDistance || (right.height ?? 0) - (left.height ?? 0);
    })[0];
    if (primary === undefined) throw new Error("Video optimization created no usable variant.");
    return {
      variants,
      primary,
      width: primary.width!,
      height: primary.height!,
      durationSeconds: analysis.durationSeconds,
      generatedPoster,
    };
  } catch (error) {
    await Promise.all([
      ...variants.map((variant) => storageProvider.delete(variant.storage.key).catch(() => undefined)),
      ...(generatedPoster === undefined ? [] : [storageProvider.delete(generatedPoster.storage.key).catch(() => undefined)]),
    ]);
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
