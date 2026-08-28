import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import type { SeoAuditCheck, SeoContentType } from "@maglive/contracts";

export type SeoAuditRecord = {
  contentType: SeoContentType;
  entityId: Types.ObjectId;
  locale: string;
  url: string;
  finalUrl?: string;
  httpStatus: number;
  score: number;
  checks: SeoAuditCheck[];
  brokenLinks: string[];
  error?: string;
  createdAt: Date;
};

export type SeoAuditDocument = HydratedDocument<SeoAuditRecord>;

const checkSchema = new Schema<SeoAuditCheck>(
  {
    key: { type: String, required: true, maxlength: 120 },
    status: { type: String, enum: ["passed", "recommendation", "critical"], required: true },
    message: { type: String, required: true, maxlength: 500 },
    value: { type: String, maxlength: 2_048 },
  },
  { _id: false },
);

const auditSchema = new Schema<SeoAuditRecord>(
  {
    contentType: { type: String, enum: ["product", "category", "page", "news", "event", "solution", "other"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    locale: { type: String, required: true, maxlength: 32 },
    url: { type: String, required: true, maxlength: 2_048 },
    finalUrl: { type: String, maxlength: 2_048 },
    httpStatus: { type: Number, required: true, min: 100, max: 599 },
    score: { type: Number, required: true, min: 0, max: 100 },
    checks: { type: [checkSchema], required: true, default: () => [] },
    brokenLinks: { type: [String], required: true, default: () => [] },
    error: { type: String, maxlength: 500 },
  },
  { collection: "seo_audits", timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

auditSchema.index({ entityId: 1, locale: 1, createdAt: -1 });
auditSchema.index({ url: 1, createdAt: -1 });

export const SeoAuditModel: Model<SeoAuditRecord> =
  (mongoose.models.SeoAudit as Model<SeoAuditRecord> | undefined) ??
  mongoose.model<SeoAuditRecord>("SeoAudit", auditSchema);
