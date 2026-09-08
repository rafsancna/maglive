import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

export type SiteSettings = {
  key: "site";
  iconMediaId?: Types.ObjectId;
  version: number;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type SiteSettingsDocument = HydratedDocument<SiteSettings>;

const siteSettingsSchema = new Schema<SiteSettings>(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      default: "site",
    },
    iconMediaId: { type: Schema.Types.ObjectId },
    version: { type: Number, required: true, min: 0, default: 0 },
    updatedBy: { type: Schema.Types.ObjectId, required: true },
  },
  { collection: "site_settings", timestamps: true, versionKey: false },
);

siteSettingsSchema.index({ iconMediaId: 1 });

export const SiteSettingsModel: Model<SiteSettings> =
  (mongoose.models.SiteSettings as Model<SiteSettings> | undefined) ??
  mongoose.model<SiteSettings>("SiteSettings", siteSettingsSchema);
