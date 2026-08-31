import type { MediaKind, MediaProcessingStage } from "@maglive/contracts";
import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

export type MediaTranslation = {
  title?: string;
  alt?: string;
  caption?: string;
};

export type MediaStorage = {
  provider: string;
  key: string;
};

export type MediaVariant = {
  label: string;
  storage: MediaStorage;
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
  codec?: string;
};

export type Media = {
  kind: MediaKind;
  storage?: MediaStorage;
  sourceStorage?: MediaStorage;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  originalSizeBytes?: number;
  optimizedSizeBytes?: number;
  checksum: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  posterMediaId?: Types.ObjectId;
  generatedPoster?: MediaVariant;
  variants: MediaVariant[];
  audioPolicy: "keep" | "remove";
  defaultTranslations: Map<string, MediaTranslation>;
  status: "queued" | "processing" | "ready" | "failed" | "deleting";
  progress: number;
  processingStage?: MediaProcessingStage;
  processingError?: string;
  processingAttempts: number;
  processingJobId?: string;
  referenceGuard: number;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type MediaDocument = HydratedDocument<Media>;

const mediaTranslationSchema = new Schema<MediaTranslation>(
  {
    title: { type: String, trim: true, maxlength: 240 },
    alt: { type: String, trim: true, maxlength: 240 },
    caption: { type: String, trim: true, maxlength: 1_000 },
  },
  { _id: false },
);

const mediaStorageSchema = new Schema<MediaStorage>(
  {
    provider: { type: String, required: true, maxlength: 80 },
    key: { type: String, required: true },
  },
  { _id: false },
);

const mediaVariantSchema = new Schema<MediaVariant>(
  {
    label: { type: String, required: true, maxlength: 40 },
    storage: { type: mediaStorageSchema, required: true },
    mimeType: { type: String, required: true, maxlength: 160 },
    sizeBytes: { type: Number, required: true, min: 0 },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    codec: { type: String, maxlength: 80 },
  },
  { _id: false },
);

const mediaSchema = new Schema<Media>(
  {
    kind: {
      type: String,
      enum: ["image", "video", "document"],
      required: true,
    },
    storage: { type: mediaStorageSchema },
    sourceStorage: { type: mediaStorageSchema, select: false },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: { type: String, required: true, maxlength: 160 },
    sizeBytes: { type: Number, required: true, min: 0 },
    originalSizeBytes: { type: Number, min: 0 },
    optimizedSizeBytes: { type: Number, min: 0 },
    checksum: { type: String, required: true },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    durationSeconds: { type: Number, min: 0 },
    posterMediaId: { type: Schema.Types.ObjectId },
    generatedPoster: { type: mediaVariantSchema },
    variants: { type: [mediaVariantSchema], required: true, default: () => [] },
    audioPolicy: {
      type: String,
      enum: ["keep", "remove"],
      required: true,
      default: "keep",
    },
    defaultTranslations: {
      type: Map,
      of: mediaTranslationSchema,
      required: true,
      default: () => new Map(),
    },
    status: {
      type: String,
      enum: ["queued", "processing", "ready", "failed", "deleting"],
      required: true,
      default: "queued",
    },
    progress: { type: Number, required: true, min: 0, max: 100, default: 0 },
    processingStage: {
      type: String,
      enum: [
        "queued",
        "analyzing",
        "optimizing-image",
        "creating-480",
        "creating-768",
        "creating-1280",
        "creating-1920",
        "creating-2560",
        "creating-720p",
        "creating-1080p",
        "creating-1440p",
        "creating-source",
        "generating-poster",
        "finalizing",
        "ready",
        "failed",
      ],
    },
    processingError: { type: String, maxlength: 2_000 },
    processingAttempts: { type: Number, required: true, min: 0, default: 0 },
    processingJobId: { type: String, maxlength: 160 },
    referenceGuard: { type: Number, required: true, default: 0, select: false },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
  },
  {
    collection: "media",
    timestamps: true,
    versionKey: "version",
    optimisticConcurrency: true,
  },
);

mediaSchema.index({ kind: 1, createdAt: -1 });
mediaSchema.index({ status: 1, createdAt: -1 });
mediaSchema.index(
  { "storage.provider": 1, "storage.key": 1 },
  { unique: true, sparse: true },
);
mediaSchema.index(
  { "sourceStorage.provider": 1, "sourceStorage.key": 1 },
  { unique: true, sparse: true },
);
mediaSchema.index({ posterMediaId: 1 });

export const MediaModel: Model<Media> =
  (mongoose.models.Media as Model<Media> | undefined) ??
  mongoose.model<Media>("Media", mediaSchema);
