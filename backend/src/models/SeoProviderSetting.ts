import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type {
  SeoConnectionProvider,
  SeoProviderConnectionStatus,
} from "@maglive/contracts";

export type SeoProviderSettingRecord = {
  provider: SeoConnectionProvider;
  enabled: boolean;
  configured: boolean;
  credentialsEncrypted: string;
  credentialHint?: string;
  status: SeoProviderConnectionStatus;
  message: string;
  lastCheckedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type SeoProviderSettingDocument = HydratedDocument<SeoProviderSettingRecord>;

const settingSchema = new Schema<SeoProviderSettingRecord>(
  {
    provider: {
      type: String,
      enum: ["google", "bing", "baidu", "yandex", "indexnow"],
      required: true,
      unique: true,
    },
    enabled: { type: Boolean, required: true, default: true },
    configured: { type: Boolean, required: true, default: false },
    credentialsEncrypted: { type: String, required: true },
    credentialHint: { type: String, maxlength: 120 },
    status: {
      type: String,
      enum: ["not-configured", "configured", "connected", "error", "unsupported"],
      required: true,
      default: "not-configured",
    },
    message: { type: String, required: true, maxlength: 500 },
    lastCheckedAt: Date,
  },
  { collection: "seo_provider_settings", timestamps: true, versionKey: false },
);

export const SeoProviderSettingModel: Model<SeoProviderSettingRecord> =
  (mongoose.models.SeoProviderSetting as Model<SeoProviderSettingRecord> | undefined) ??
  mongoose.model<SeoProviderSettingRecord>("SeoProviderSetting", settingSchema);
