import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import type { SearchMetricSnapshot, SearchProvider } from "@maglive/contracts";

export type SearchMetricRecord = {
  provider: SearchProvider;
  site: string;
  entityId?: Types.ObjectId;
  entityUrl?: string;
  locale?: string;
  startDate: string;
  endDate: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  indexed?: boolean;
  crawlLastCrawled?: Date;
  sitemapStatus?: string;
  queryCount?: number;
  fetchedAt: Date;
};
export type SearchMetricDocument = HydratedDocument<SearchMetricRecord>;

const snapshotSchema = new Schema<SearchMetricRecord>(
  {
    provider: { type: String, enum: ["google", "bing", "baidu", "yandex"], required: true },
    site: { type: String, required: true, maxlength: 2_048 },
    entityId: { type: Schema.Types.ObjectId, index: true },
    entityUrl: { type: String, maxlength: 2_048 },
    locale: { type: String, maxlength: 32 },
    startDate: { type: String, required: true, maxlength: 10 },
    endDate: { type: String, required: true, maxlength: 10 },
    clicks: Number,
    impressions: Number,
    ctr: Number,
    position: Number,
    indexed: Boolean,
    crawlLastCrawled: Date,
    sitemapStatus: String,
    queryCount: Number,
    fetchedAt: { type: Date, required: true, default: Date.now },
  },
  { collection: "search_metric_snapshots", versionKey: false },
);

snapshotSchema.index({ provider: 1, site: 1, entityUrl: 1, endDate: -1 });
snapshotSchema.index({ fetchedAt: -1 });

export const SearchMetricSnapshotModel: Model<SearchMetricRecord> =
  (mongoose.models.SearchMetricSnapshot as Model<SearchMetricRecord> | undefined) ??
  mongoose.model<SearchMetricRecord>("SearchMetricSnapshot", snapshotSchema);

export function toSearchMetricDto(record: SearchMetricRecord & { _id: Types.ObjectId }): SearchMetricSnapshot {
  return {
    id: record._id.toString(),
    provider: record.provider as SearchProvider,
    site: record.site,
    ...(record.entityUrl === undefined ? {} : { entityUrl: record.entityUrl }),
    ...(record.locale === undefined ? {} : { locale: record.locale }),
    startDate: record.startDate,
    endDate: record.endDate,
    ...(record.clicks === undefined ? {} : { clicks: record.clicks }),
    ...(record.impressions === undefined ? {} : { impressions: record.impressions }),
    ...(record.ctr === undefined ? {} : { ctr: record.ctr }),
    ...(record.position === undefined ? {} : { position: record.position }),
    ...(record.indexed === undefined ? {} : { indexed: record.indexed }),
    ...(record.crawlLastCrawled === undefined ? {} : { crawlLastCrawled: record.crawlLastCrawled.toISOString() }),
    ...(record.sitemapStatus === undefined ? {} : { sitemapStatus: record.sitemapStatus }),
    ...(record.queryCount === undefined ? {} : { queryCount: record.queryCount }),
    fetchedAt: record.fetchedAt.toISOString(),
  };
}
