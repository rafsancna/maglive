import {
  indexingSubmissionSchema,
  type IndexingSubmission,
  type SeoContentType,
  type SearchProvider,
} from "@maglive/contracts";
import type { AppConfig } from "../config/env.js";
import type { Types } from "mongoose";
import { CategoryModel } from "../models/Category.js";
import { ProductModel } from "../models/Product.js";
import { UrlSubmissionModel, toIndexingSubmissionDto } from "../models/UrlSubmission.js";
import { effectiveProviderCredentials } from "./seoProviderSettingsService.js";

type EntityKind = Extract<SeoContentType, "product" | "category">;

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === 11000;
}

async function providers(config: AppConfig): Promise<SearchProvider[]> {
  const [indexNow, baidu] = await Promise.all([
    effectiveProviderCredentials("indexnow", config),
    effectiveProviderCredentials("baidu", config),
  ]);
  return [
    ...(indexNow.key === undefined ? [] : ["bing", "yandex"] as const),
    ...(baidu.site === undefined || baidu.token === undefined ? [] : ["baidu"] as const),
  ];
}

async function publicEntityUrls(kind: EntityKind, id: string, config: AppConfig): Promise<{ url: string; revision: string }[]> {
  const origin = new URL(config.frontendOrigin);
  if (kind === "product") {
    const entity = await ProductModel.findOne({ _id: id, status: "published" });
    if (entity?.publishedGlobal === undefined) return [];
    const category = await CategoryModel.findById(entity.publishedGlobal.data.categoryId);
    if (category?.publishedGlobal === undefined) return [];
    return [...entity.publishedSnapshots.entries()].flatMap(([locale, snapshot]) => snapshot.data.seo.robots?.index === false ? [] : [{ url: new URL(`/${locale}/products/${category.publishedGlobal?.data.slug}/${entity.publishedGlobal?.data.slug}`, origin).toString(), revision: snapshot.publicationRevision }]);
  }
  const entity = await CategoryModel.findOne({ _id: id, status: "active" });
  if (entity?.publishedGlobal === undefined) return [];
  return [...entity.publishedSnapshots.entries()].flatMap(([locale, snapshot]) => snapshot.data.seo.robots?.index === false ? [] : [{ url: new URL(`/${locale}/products/category/${entity.publishedGlobal?.data.slug}`, origin).toString(), revision: snapshot.publicationRevision }]);
}

export async function enqueuePublishedEntity(kind: EntityKind, id: string, config: AppConfig): Promise<void> {
  const urls = await publicEntityUrls(kind, id, config);
  for (const provider of await providers(config)) {
    for (const item of urls) {
      try {
        await UrlSubmissionModel.create({ provider, url: item.url, revision: item.revision, status: "pending", attempts: 0, nextAttemptAt: new Date() });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
      }
    }
  }
}

async function submitIndexNow(url: string, config: AppConfig): Promise<void> {
  const credentials = await effectiveProviderCredentials("indexnow", config);
  if (credentials.key === undefined) throw new Error("IndexNow is not configured.");
  const host = new URL(config.frontendOrigin).host;
  const response = await fetch("https://api.indexnow.org/indexnow", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ host, key: credentials.key, ...(credentials.keyLocation === undefined ? {} : { keyLocation: credentials.keyLocation }), urlList: [url] }), signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`IndexNow returned HTTP ${response.status}.`);
}

async function submitBaidu(url: string, config: AppConfig): Promise<void> {
  const credentials = await effectiveProviderCredentials("baidu", config);
  if (credentials.site === undefined || credentials.token === undefined) throw new Error("Baidu URL submission is not configured.");
  const endpoint = new URL("https://data.zz.baidu.com/urls");
  endpoint.searchParams.set("site", credentials.site);
  endpoint.searchParams.set("token", credentials.token);
  const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "text/plain", Accept: "application/json" }, body: `${url}\n`, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Baidu URL submission returned HTTP ${response.status}.`);
}

async function processOne(record: UrlSubmissionDocumentLike, config: AppConfig): Promise<void> {
  try {
    if (record.provider === "bing" || record.provider === "yandex") await submitIndexNow(record.url, config);
    else if (record.provider === "baidu") await submitBaidu(record.url, config);
    await UrlSubmissionModel.updateOne({ _id: record._id }, { $set: { status: "submitted", submittedAt: new Date(), lastError: undefined } });
  } catch (error) {
    const attempts = record.attempts + 1;
    const nextAttemptAt = new Date(Date.now() + Math.min(86_400_000, 2 ** Math.min(attempts, 10) * 1_000));
    await UrlSubmissionModel.updateOne({ _id: record._id }, { $set: { status: attempts >= 8 ? "failed" : "pending", attempts, nextAttemptAt, lastError: error instanceof Error ? error.message : "Submission failed." } });
  }
}

type UrlSubmissionDocumentLike = { _id: Types.ObjectId; provider: SearchProvider; url: string; attempts: number };

export async function processPendingSubmissions(config: AppConfig, limit = 20): Promise<void> {
  const records = await UrlSubmissionModel.find({ status: { $in: ["pending", "failed"] }, nextAttemptAt: { $lte: new Date() }, attempts: { $lt: 8 } }).sort({ nextAttemptAt: 1 }).limit(limit);
  await Promise.all(records.map((record) => processOne(record, config)));
}

export async function listSubmissions(): Promise<IndexingSubmission[]> {
  const records = await UrlSubmissionModel.find().sort({ createdAt: -1 }).limit(100);
  return records.map((record) => indexingSubmissionSchema.parse(toIndexingSubmissionDto(record)));
}
