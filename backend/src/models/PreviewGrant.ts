import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import type { LocaleCode } from "@maglive/contracts";

export type PreviewGrant = {
  tokenHash: string;
  productId: Types.ObjectId;
  locale: LocaleCode;
  administratorId: Types.ObjectId;
  workingVersion: number;
  consumedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
};
export type PreviewGrantDocument = HydratedDocument<PreviewGrant>;

const schema = new Schema<PreviewGrant>({
  tokenHash: { type: String, required: true, unique: true, index: true },
  productId: { type: Schema.Types.ObjectId, required: true, index: true },
  locale: {
    type: String,
    match: /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/,
    required: true,
  },
  administratorId: { type: Schema.Types.ObjectId, required: true, index: true },
  workingVersion: { type: Number, required: true, min: 0 },
  consumedAt: { type: Date },
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, required: true, default: Date.now },
}, { versionKey: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PreviewGrantModel: Model<PreviewGrant> =
  (mongoose.models.PreviewGrant as Model<PreviewGrant> | undefined) ?? mongoose.model<PreviewGrant>("PreviewGrant", schema);
