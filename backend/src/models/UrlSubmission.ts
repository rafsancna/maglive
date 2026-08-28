import mongoose, { Schema, type HydratedDocument, type Model } from "mongoose";
import type { IndexingSubmission, SearchProvider } from "@maglive/contracts";

export type UrlSubmissionRecord = Omit<IndexingSubmission, "id" | "submittedAt" | "nextAttemptAt"> & {
  submittedAt?: Date;
  nextAttemptAt?: Date;
};
export type UrlSubmissionDocument = HydratedDocument<UrlSubmissionRecord>;

const submissionSchema = new Schema<UrlSubmissionRecord>(
  {
    provider: { type: String, enum: ["google", "bing", "baidu", "yandex"], required: true },
    url: { type: String, required: true, maxlength: 2_048 },
    revision: { type: String, required: true, maxlength: 120 },
    status: { type: String, enum: ["pending", "submitted", "failed", "skipped"], required: true, default: "pending" },
    attempts: { type: Number, required: true, min: 0, default: 0 },
    lastError: { type: String, maxlength: 500 },
    submittedAt: Date,
    nextAttemptAt: Date,
  },
  { collection: "url_submissions", timestamps: true, versionKey: false },
);

submissionSchema.index({ provider: 1, url: 1, revision: 1 }, { unique: true });
submissionSchema.index({ status: 1, nextAttemptAt: 1 });

export const UrlSubmissionModel: Model<UrlSubmissionRecord> =
  (mongoose.models.UrlSubmission as Model<UrlSubmissionRecord> | undefined) ??
  mongoose.model<UrlSubmissionRecord>("UrlSubmission", submissionSchema);

export function toIndexingSubmissionDto(record: UrlSubmissionDocument): IndexingSubmission {
  return {
    id: record._id.toString(),
    provider: record.provider as SearchProvider,
    url: record.url,
    revision: record.revision,
    status: record.status,
    attempts: record.attempts,
    ...(record.lastError === undefined ? {} : { lastError: record.lastError }),
    ...(record.submittedAt === undefined ? {} : { submittedAt: record.submittedAt.toISOString() }),
    ...(record.nextAttemptAt === undefined ? {} : { nextAttemptAt: record.nextAttemptAt.toISOString() }),
  };
}
