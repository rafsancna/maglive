import mongoose, { Schema, type HydratedDocument, type Model, type Types } from "mongoose";
import type { NewsContentBlock } from "@maglive/contracts";

export type NewsSeo = {
  focusKeyphrase?: string; title?: string; description?: string; keywords: string[];
  openGraphTitle?: string; openGraphDescription?: string; openGraphMediaId?: Types.ObjectId;
  canonicalUrlOverride?: string; robots?: { index: boolean; follow: boolean };
};
export type NewsTranslation = { title: string; excerpt: string; content: NewsContentBlock[]; seo: NewsSeo };
export type PublishedNewsGlobal = {
  slug: string; category: string; authorName: string; featured: boolean; tags: string[];
  heroMediaId?: Types.ObjectId; publishedAt: Date;
};
export type PublishedNewsLocale = { publishedAt: Date; data: NewsTranslation };
export type News = {
  slug: string; category: string; authorName: string; featured: boolean; tags: string[];
  heroMediaId?: Types.ObjectId; translations: Map<string, NewsTranslation>;
  publishedGlobal?: PublishedNewsGlobal; publishedSnapshots: Map<string, PublishedNewsLocale>;
  status: "draft" | "published" | "archived"; firstPublishedAt?: Date;
  createdBy: Types.ObjectId; updatedBy: Types.ObjectId; createdAt: Date; updatedAt: Date; version: number;
};
export type NewsDocument = HydratedDocument<News>;

const seoSchema = new Schema<NewsSeo>({
  focusKeyphrase: { type: String, trim: true, maxlength: 160 }, title: { type: String, trim: true, maxlength: 70 },
  description: { type: String, trim: true, maxlength: 320 }, keywords: { type: [String], default: () => [] },
  openGraphTitle: { type: String, trim: true, maxlength: 70 }, openGraphDescription: { type: String, trim: true, maxlength: 320 },
  openGraphMediaId: Schema.Types.ObjectId, canonicalUrlOverride: { type: String, trim: true, maxlength: 2_048 },
  robots: { type: new Schema({ index: { type: Boolean, required: true }, follow: { type: Boolean, required: true } }, { _id: false }) },
}, { _id: false, strict: "throw" });

const translationSchema = new Schema<NewsTranslation>({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  excerpt: { type: String, required: true, trim: true, maxlength: 500 },
  content: { type: [Schema.Types.Mixed], required: true, default: () => [] } as never,
  seo: { type: seoSchema, required: true, default: () => ({ keywords: [] }) },
}, { _id: false, strict: "throw" });

const publishedGlobalSchema = new Schema<PublishedNewsGlobal>({
  slug: { type: String, required: true }, category: { type: String, required: true }, authorName: { type: String, required: true },
  featured: { type: Boolean, required: true }, tags: { type: [String], required: true }, heroMediaId: Schema.Types.ObjectId,
  publishedAt: { type: Date, required: true },
}, { _id: false, strict: "throw" });
const publishedLocaleSchema = new Schema<PublishedNewsLocale>({
  publishedAt: { type: Date, required: true }, data: { type: translationSchema, required: true },
}, { _id: false, strict: "throw" });

const newsSchema = new Schema<News>({
  slug: { type: String, required: true, trim: true, lowercase: true, minlength: 2, maxlength: 140 },
  category: { type: String, required: true, trim: true, lowercase: true, maxlength: 48, default: "company-news" },
  authorName: { type: String, required: true, trim: true, maxlength: 120 }, featured: { type: Boolean, required: true, default: false },
  tags: { type: [String], required: true, default: () => [] }, heroMediaId: Schema.Types.ObjectId,
  translations: { type: Map, of: translationSchema, required: true, default: () => new Map() },
  publishedGlobal: { type: publishedGlobalSchema },
  publishedSnapshots: { type: Map, of: publishedLocaleSchema, required: true, default: () => new Map() },
  status: { type: String, enum: ["draft", "published", "archived"], required: true, default: "draft" },
  firstPublishedAt: Date, createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true }, updatedBy: { type: Schema.Types.ObjectId, required: true },
}, { collection: "news", timestamps: true, versionKey: "version", optimisticConcurrency: true, strict: "throw" });

newsSchema.index({ slug: 1 }, { unique: true });
newsSchema.index({ status: 1, "publishedGlobal.publishedAt": -1 });
newsSchema.index({ category: 1, status: 1 });
newsSchema.index({ tags: 1, status: 1 });

export const NewsModel: Model<News> = (mongoose.models.News as Model<News> | undefined) ?? mongoose.model<News>("News", newsSchema);
