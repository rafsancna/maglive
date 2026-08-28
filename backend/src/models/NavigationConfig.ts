import type { NavigationData } from "@maglive/contracts";
import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";

export type NavigationConfig = {
  key: "primary";
  data: NavigationData;
  version: number;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type NavigationConfigDocument = HydratedDocument<NavigationConfig>;

const navigationConfigSchema = new Schema<NavigationConfig>(
  {
    key: { type: String, required: true, unique: true, immutable: true, default: "primary" },
    data: { type: Schema.Types.Mixed, required: true },
    version: { type: Number, required: true, min: 0, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: "navigation_config", timestamps: true, versionKey: false },
);

export const NavigationConfigModel: Model<NavigationConfig> =
  (mongoose.models.NavigationConfig as Model<NavigationConfig> | undefined) ??
  mongoose.model<NavigationConfig>("NavigationConfig", navigationConfigSchema);
