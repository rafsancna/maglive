import type { AdminMediaDto, MediaProcessingStage } from "@maglive/contracts";

const labels: Record<MediaProcessingStage, string> = {
  queued: "Queued",
  analyzing: "Analyzing media",
  "optimizing-image": "Optimizing image",
  "creating-480": "Creating 480px",
  "creating-768": "Creating 768px",
  "creating-1280": "Creating 1280px",
  "creating-1920": "Creating 1920px",
  "creating-2560": "Creating 2560px",
  "creating-720p": "Creating 720p",
  "creating-1080p": "Creating 1080p",
  "creating-1440p": "Creating 1440p",
  "creating-source": "Creating source-size version",
  "generating-poster": "Generating poster",
  finalizing: "Finalizing",
  ready: "Ready",
  failed: "Failed",
};

export function mediaStageLabel(media: AdminMediaDto): string {
  return media.processingStage === undefined ? media.status : labels[media.processingStage];
}

export function savedPercentage(media: AdminMediaDto): number | undefined {
  const original = media.originalSizeBytes ?? media.sizeBytes;
  if (media.optimizedSizeBytes === undefined || original === 0) return undefined;
  return Math.max(0, (1 - media.optimizedSizeBytes / original) * 100);
}
