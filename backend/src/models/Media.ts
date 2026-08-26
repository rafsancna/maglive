import type { MediaKind } from "@maglive/contracts";
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

export type Media = {
  kind: MediaKind;
  storage: {
    provider: "local";
    key: string;
  };
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  posterMediaId?: Types.ObjectId;
  defaultTranslations: Map<string, MediaTranslation>;
  status: "processing" | "ready" | "failed" | "deleting";
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

const mediaSchema = new Schema<Media>(
  {
    kind: {
      type: String,
      enum: ["image", "video", "document"],
      required: true,
    },
    storage: {
      type: new Schema(
        {
          provider: { type: String, enum: ["local"], required: true },
          key: { type: String, required: true },
        },
        { _id: false },
      ),
      required: true,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    mimeType: { type: String, required: true, maxlength: 160 },
    sizeBytes: { type: Number, required: true, min: 0 },
    checksum: { type: String, required: true },
    width: { type: Number, min: 1 },
    height: { type: Number, min: 1 },
    durationSeconds: { type: Number, min: 0 },
    posterMediaId: { type: Schema.Types.ObjectId },
    defaultTranslations: {
      type: Map,
      of: mediaTranslationSchema,
      required: true,
      default: () => new Map(),
    },
    status: {
      type: String,
      enum: ["processing", "ready", "failed", "deleting"],
      required: true,
      default: "processing",
    },
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
mediaSchema.index({ "storage.provider": 1, "storage.key": 1 }, { unique: true });
mediaSchema.index({ posterMediaId: 1 });

export const MediaModel: Model<Media> =
  (mongoose.models.Media as Model<Media> | undefined) ??
  mongoose.model<Media>("Media", mediaSchema);
