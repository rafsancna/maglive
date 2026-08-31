import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MediaProcessingStage } from "@maglive/contracts";
import sharp from "sharp";
import type { MediaVariant } from "../models/Media.js";
import type { StorageProvider } from "../storage/StorageProvider.js";

const RESPONSIVE_WIDTHS = [480, 768, 1280, 1920, 2560] as const;

export type OptimizationProgress = (
  stage: MediaProcessingStage,
  progress: number,
) => Promise<void>;

export type OptimizedMediaResult = Readonly<{
  variants: MediaVariant[];
  primary: MediaVariant;
  width: number;
  height: number;
  durationSeconds?: number;
  generatedPoster?: MediaVariant;
}>;

function stageForWidth(width: number): MediaProcessingStage {
  return RESPONSIVE_WIDTHS.includes(width as (typeof RESPONSIVE_WIDTHS)[number])
    ? (`creating-${width}` as MediaProcessingStage)
    : "optimizing-image";
}

export async function optimizeImage(
  inputPath: string,
  storageProvider: StorageProvider,
  report: OptimizationProgress,
): Promise<OptimizedMediaResult> {
  await report("analyzing", 5);
  const metadata = await sharp(inputPath).metadata();
  if (metadata.width === undefined || metadata.height === undefined) {
    throw new Error("Sharp could not determine the image dimensions.");
  }
  const rotated = metadata.orientation !== undefined && metadata.orientation >= 5 && metadata.orientation <= 8;
  const sourceWidth = rotated ? metadata.height : metadata.width;
  const sourceHeight = rotated ? metadata.width : metadata.height;
  const widths = [...new Set([
    ...RESPONSIVE_WIDTHS.filter((width) => width <= sourceWidth),
    Math.min(sourceWidth, RESPONSIVE_WIDTHS.at(-1)!),
  ])].sort((left, right) => left - right);
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "maglive-image-"));
  const variants: MediaVariant[] = [];
  try {
    const work = widths.flatMap((width) => [
      { width, extension: "avif", mimeType: "image/avif", quality: 68 },
      { width, extension: "webp", mimeType: "image/webp", quality: 82 },
    ] as const);
    for (const [index, variant] of work.entries()) {
      const progress = 10 + Math.round((index / Math.max(work.length, 1)) * 78);
      await report(stageForWidth(variant.width), progress);
      const outputPath = path.join(
        temporaryDirectory,
        `${variant.width}.${variant.extension}`,
      );
      const pipeline = sharp(inputPath)
        .rotate()
        .resize({ width: variant.width, withoutEnlargement: true, fit: "inside" });
      const outputMetadata = variant.extension === "avif"
        ? await pipeline.avif({ quality: variant.quality, effort: 4 }).toFile(outputPath)
        : await pipeline.webp({ quality: variant.quality, effort: 4 }).toFile(outputPath);
      const stored = await storageProvider.save({
        temporaryPath: outputPath,
        kind: "image",
        extension: variant.extension,
      });
      variants.push({
        label: `${variant.width}-${variant.extension}`,
        storage: { provider: stored.provider, key: stored.key },
        mimeType: variant.mimeType,
        sizeBytes: stored.sizeBytes,
        width: outputMetadata.width,
        height:
          outputMetadata.height ??
          Math.max(1, Math.round((sourceHeight / sourceWidth) * variant.width)),
        codec: variant.extension,
      });
    }
    const primary = [...variants]
      .filter((variant) => variant.mimeType === "image/webp")
      .sort((left, right) => (right.width ?? 0) - (left.width ?? 0))[0];
    if (primary === undefined) throw new Error("Image optimization created no usable variant.");
    return { variants, primary, width: primary.width!, height: primary.height! };
  } catch (error) {
    await Promise.all(
      variants.map((variant) => storageProvider.delete(variant.storage.key).catch(() => undefined)),
    );
    throw error;
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}
