import {
  newsContentBlockSchema,
  newsTranslationSchema,
  type AdminNewsListDto,
  type AdminNewsListQuery,
  type CreateNewsRequest,
  type LocaleCode,
  type NewsAdminDto,
  type NewsContentBlock,
  type PublicMediaDto,
  type PublicNewsContentBlock,
  type PublicNewsDetailDto,
  type PublicNewsListDto,
  type PublicNewsListQuery,
  type PublicNewsSummaryDto,
  type PublishNewsRequest,
  type UnpublishNewsRequest,
  type UpdateNewsRequest,
} from "@maglive/contracts";
import type { QueryFilter, mongo } from "mongoose";
import { Types } from "mongoose";
import { AppError } from "../errors/AppError.js";
import { MediaModel, type MediaDocument } from "../models/Media.js";
import { NewsModel, type NewsDocument, type NewsSeo, type NewsTranslation } from "../models/News.js";
import type { StorageProvider } from "../storage/StorageProvider.js";
import { assertLanguagesExist, listLanguageCodes, requireLanguage } from "./languageService.js";

type AdminActor = Readonly<{ id: string }>;

function duplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as mongo.MongoServerError).code === 11000;
}
function assertVersion(news: NewsDocument, version: number): void {
  if (news.version !== version) throw new AppError(409, "VERSION_CONFLICT", "This news item changed after it was loaded. Refresh and try again.");
}
function normalizeTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}
function inputTranslation(value: NonNullable<CreateNewsRequest["translations"][LocaleCode]>): NewsTranslation {
  return {
    title: value.title,
    excerpt: value.excerpt,
    content: value.content.map((block) => ({ ...block })),
    seo: { keywords: [...value.seo.keywords],
      ...(value.seo.focusKeyphrase === undefined ? {} : { focusKeyphrase: value.seo.focusKeyphrase }),
      ...(value.seo.title === undefined ? {} : { title: value.seo.title }),
      ...(value.seo.description === undefined ? {} : { description: value.seo.description }),
      ...(value.seo.openGraphTitle === undefined ? {} : { openGraphTitle: value.seo.openGraphTitle }),
      ...(value.seo.openGraphDescription === undefined ? {} : { openGraphDescription: value.seo.openGraphDescription }),
      ...(value.seo.openGraphMediaId === undefined ? {} : { openGraphMediaId: new Types.ObjectId(value.seo.openGraphMediaId) }),
      ...(value.seo.canonicalUrlOverride === undefined ? {} : { canonicalUrlOverride: value.seo.canonicalUrlOverride }),
      ...(value.seo.robots === undefined ? {} : { robots: { ...value.seo.robots } }), },
  };
}
function outputSeo(seo: NewsSeo) {
  return {
    ...(seo.focusKeyphrase === undefined ? {} : { focusKeyphrase: seo.focusKeyphrase }),
    ...(seo.title === undefined ? {} : { title: seo.title }),
    ...(seo.description === undefined ? {} : { description: seo.description }),
    keywords: [...(seo.keywords ?? [])],
    ...(seo.openGraphTitle === undefined ? {} : { openGraphTitle: seo.openGraphTitle }),
    ...(seo.openGraphDescription === undefined ? {} : { openGraphDescription: seo.openGraphDescription }),
    ...(seo.openGraphMediaId === undefined ? {} : { openGraphMediaId: seo.openGraphMediaId.toString() }),
    ...(seo.canonicalUrlOverride === undefined ? {} : { canonicalUrlOverride: seo.canonicalUrlOverride }),
    ...(seo.robots === undefined ? {} : { robots: { ...seo.robots } }),
  };
}
function outputTranslation(value: NewsTranslation) {
  return newsTranslationSchema.parse({ title: value.title, excerpt: value.excerpt, content: value.content, seo: outputSeo(value.seo) });
}
function translationRecord(map: Map<string, NewsTranslation>) {
  return Object.fromEntries([...map.entries()].map(([locale, value]) => [locale, outputTranslation(value)]));
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value);
}
function comparable(value: unknown): string { return stableJson(value); }
function escapedRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
async function localeStates(news: NewsDocument): Promise<Record<string, "incomplete" | "draft" | "published" | "changes-pending">> {
  const locales = await listLanguageCodes();
  return Object.fromEntries(locales.map((locale) => {
    const working = news.translations.get(locale);
    const published = news.publishedSnapshots.get(locale);
    if (working === undefined) return [locale, "incomplete"];
    if (published === undefined) return [locale, "draft"];
    return [locale, comparable(outputTranslation(working)) === comparable(outputTranslation(published.data)) ? "published" : "changes-pending"];
  }));
}
export async function toNewsAdminDto(news: NewsDocument): Promise<NewsAdminDto> {
  return {
    id: news._id.toString(), slug: news.slug, category: news.category, authorName: news.authorName, featured: news.featured,
    tags: [...news.tags], ...(news.heroMediaId === undefined ? {} : { heroMediaId: news.heroMediaId.toString() }),
    translations: translationRecord(news.translations), status: news.status,
    ...(news.publishedGlobal === undefined ? {} : { publishedGlobal: {
      slug: news.publishedGlobal.slug, category: news.publishedGlobal.category, authorName: news.publishedGlobal.authorName,
      featured: news.publishedGlobal.featured, tags: [...news.publishedGlobal.tags],
      ...(news.publishedGlobal.heroMediaId === undefined ? {} : { heroMediaId: news.publishedGlobal.heroMediaId.toString() }),
      publishedAt: news.publishedGlobal.publishedAt.toISOString(),
    } }),
    publishedSnapshots: Object.fromEntries([...news.publishedSnapshots.entries()].map(([locale, snapshot]) => [locale, { publishedAt: snapshot.publishedAt.toISOString(), data: outputTranslation(snapshot.data) }])),
    localeStates: await localeStates(news), ...(news.firstPublishedAt === undefined ? {} : { firstPublishedAt: news.firstPublishedAt.toISOString() }),
    createdBy: news.createdBy.toString(), updatedBy: news.updatedBy.toString(), createdAt: news.createdAt.toISOString(), updatedAt: news.updatedAt.toISOString(), version: news.version,
  };
}

function expectedMedia(translations: Iterable<NewsTranslation>, heroMediaId?: Types.ObjectId): Map<string, "image" | "video" | "document"> {
  const expected = new Map<string, "image" | "video" | "document">();
  if (heroMediaId !== undefined) expected.set(heroMediaId.toString(), "image");
  for (const translation of translations) {
    if (translation.seo.openGraphMediaId !== undefined) expected.set(translation.seo.openGraphMediaId.toString(), "image");
    for (const block of translation.content) {
      if (block.type === "image" || block.type === "video" || block.type === "document") expected.set(block.mediaId, block.type);
    }
  }
  return expected;
}
async function assertMediaReady(translations: Iterable<NewsTranslation>, heroMediaId?: Types.ObjectId): Promise<void> {
  const expected = expectedMedia(translations, heroMediaId);
  if (expected.size === 0) return;
  const media = await MediaModel.find({ _id: { $in: [...expected.keys()] }, status: "ready" }).select("kind");
  const found = new Map(media.map((item) => [item._id.toString(), item.kind]));
  for (const [id, kind] of expected) {
    if (found.get(id) !== kind) throw new AppError(409, "NEWS_MEDIA_NOT_READY", `The selected ${kind} media (${id}) is unavailable or has the wrong type.`);
  }
}

export async function createNews(input: CreateNewsRequest, actor: AdminActor): Promise<NewsAdminDto> {
  await assertLanguagesExist(Object.keys(input.translations));
  const translations = new Map(Object.entries(input.translations).flatMap(([locale, value]) => value === undefined ? [] : [[locale, inputTranslation(value)] as const]));
  const heroMediaId = input.heroMediaId === undefined ? undefined : new Types.ObjectId(input.heroMediaId);
  await assertMediaReady(translations.values(), heroMediaId);
  try {
    const news = await NewsModel.create({ slug: input.slug, category: input.category, authorName: input.authorName, featured: input.featured,
      tags: normalizeTags(input.tags), ...(heroMediaId === undefined ? {} : { heroMediaId }), translations,
      createdBy: new Types.ObjectId(actor.id), updatedBy: new Types.ObjectId(actor.id) });
    return toNewsAdminDto(news);
  } catch (error) {
    if (duplicateKeyError(error)) throw new AppError(409, "NEWS_SLUG_EXISTS", "Another news item already uses this slug.");
    throw error;
  }
}
export async function getNews(id: string): Promise<NewsAdminDto> {
  const news = await NewsModel.findById(id);
  if (news === null) throw new AppError(404, "NEWS_NOT_FOUND", "The news item was not found.");
  return toNewsAdminDto(news);
}
export async function listNews(query: AdminNewsListQuery): Promise<AdminNewsListDto> {
  const filter: QueryFilter<NewsDocument> = {};
  if (query.status !== undefined) filter.status = query.status;
  if (query.category !== undefined) filter.category = query.category;
  if (query.locale !== undefined) filter[`translations.${query.locale}`] = { $exists: true };
  if (query.search !== undefined) { const search = escapedRegex(query.search); filter.$or = [{ slug: { $regex: search, $options: "i" } }, { authorName: { $regex: search, $options: "i" } }, { "translations.en.title": { $regex: search, $options: "i" } }]; }
  const [items, total] = await Promise.all([NewsModel.find(filter).sort({ updatedAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit), NewsModel.countDocuments(filter)]);
  return { items: await Promise.all(items.map(toNewsAdminDto)), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}
export async function updateNews(id: string, input: UpdateNewsRequest, actor: AdminActor): Promise<NewsAdminDto> {
  const news = await NewsModel.findById(id);
  if (news === null) throw new AppError(404, "NEWS_NOT_FOUND", "The news item was not found.");
  assertVersion(news, input.version);
  if (input.translations !== undefined) {
    await assertLanguagesExist(Object.keys(input.translations));
    news.translations = new Map(Object.entries(input.translations).flatMap(([locale, value]) => value === undefined ? [] : [[locale, inputTranslation(value)] as const]));
  }
  if (input.slug !== undefined) news.slug = input.slug;
  if (input.category !== undefined) news.category = input.category;
  if (input.authorName !== undefined) news.authorName = input.authorName;
  if (input.featured !== undefined) news.featured = input.featured;
  if (input.tags !== undefined) news.tags = normalizeTags(input.tags);
  if (input.heroMediaId === null) news.set("heroMediaId", undefined);
  else if (input.heroMediaId !== undefined) news.heroMediaId = new Types.ObjectId(input.heroMediaId);
  news.updatedBy = new Types.ObjectId(actor.id);
  await assertMediaReady(news.translations.values(), news.heroMediaId);
  try { await news.save(); } catch (error) { if (duplicateKeyError(error)) throw new AppError(409, "NEWS_SLUG_EXISTS", "Another news item already uses this slug."); throw error; }
  return toNewsAdminDto(news);
}
export async function publishNews(id: string, input: PublishNewsRequest, actor: AdminActor): Promise<NewsAdminDto> {
  await assertLanguagesExist(input.locales);
  const news = await NewsModel.findById(id);
  if (news === null) throw new AppError(404, "NEWS_NOT_FOUND", "The news item was not found.");
  assertVersion(news, input.version);
  const translations = input.locales.map((locale) => {
    const value = news.translations.get(locale);
    if (value === undefined) throw new AppError(422, "NEWS_TRANSLATION_INCOMPLETE", `Complete the ${locale} news title, excerpt, and content before publishing.`);
    return [locale, value] as const;
  });
  await assertMediaReady(translations.map(([, value]) => value), news.heroMediaId);
  const now = new Date();
  news.publishedGlobal = { slug: news.slug, category: news.category, authorName: news.authorName, featured: news.featured, tags: [...news.tags], ...(news.heroMediaId === undefined ? {} : { heroMediaId: news.heroMediaId }), publishedAt: now };
  for (const [locale, value] of translations) news.publishedSnapshots.set(locale, { publishedAt: now, data: inputTranslation(outputTranslation(value)) });
  news.status = "published"; news.firstPublishedAt ??= now; news.updatedBy = new Types.ObjectId(actor.id);
  await news.save();
  return toNewsAdminDto(news);
}
export async function unpublishNews(id: string, input: UnpublishNewsRequest, actor: AdminActor): Promise<NewsAdminDto> {
  const news = await NewsModel.findById(id);
  if (news === null) throw new AppError(404, "NEWS_NOT_FOUND", "The news item was not found.");
  assertVersion(news, input.version);
  if (input.locale === undefined) news.publishedSnapshots.clear(); else { await requireLanguage(input.locale); news.publishedSnapshots.delete(input.locale); }
  if (news.publishedSnapshots.size === 0) { news.status = "draft"; news.set("publishedGlobal", undefined); }
  news.updatedBy = new Types.ObjectId(actor.id); await news.save(); return toNewsAdminDto(news);
}
export async function archiveNews(id: string, version: number, actor: AdminActor): Promise<NewsAdminDto> {
  const news = await NewsModel.findById(id);
  if (news === null) throw new AppError(404, "NEWS_NOT_FOUND", "The news item was not found.");
  assertVersion(news, version); news.status = "archived"; news.updatedBy = new Types.ObjectId(actor.id); await news.save(); return toNewsAdminDto(news);
}
export async function deleteNews(id: string, version: number): Promise<void> {
  const news = await NewsModel.findById(id);
  if (news === null) throw new AppError(404, "NEWS_NOT_FOUND", "The news item was not found.");
  assertVersion(news, version);
  if (news.status === "published") throw new AppError(409, "NEWS_DELETE_PUBLISHED", "Unpublish or archive this news item before deleting it.");
  await NewsModel.deleteOne({ _id: news._id, version });
}

function publicMedia(media: MediaDocument, storageProvider: StorageProvider): PublicMediaDto {
  if (media.status !== "ready" || media.storage === undefined || media.storage.provider !== storageProvider.id) throw new AppError(503, "PUBLIC_MEDIA_UNAVAILABLE", "Published news media is temporarily unavailable.");
  return { id: media._id.toString(), kind: media.kind, url: storageProvider.getPublicUrl(media.storage.key), mimeType: media.mimeType,
    ...(media.width === undefined ? {} : { width: media.width }), ...(media.height === undefined ? {} : { height: media.height }),
    ...(media.variants.length === 0 ? {} : { variants: media.variants.map((variant) => ({ label: variant.label, url: storageProvider.getPublicUrl(variant.storage.key), mimeType: variant.mimeType, sizeBytes: variant.sizeBytes, ...(variant.width === undefined ? {} : { width: variant.width }), ...(variant.height === undefined ? {} : { height: variant.height }), ...(variant.codec === undefined ? {} : { codec: variant.codec }) })) }) };
}
async function mediaMap(ids: Iterable<string>): Promise<Map<string, MediaDocument>> {
  const unique = [...new Set(ids)]; if (unique.length === 0) return new Map();
  return new Map((await MediaModel.find({ _id: { $in: unique }, status: "ready" })).map((media) => [media._id.toString(), media]));
}
function requireMedia(id: string, map: Map<string, MediaDocument>): MediaDocument {
  const media = map.get(id); if (media === undefined) throw new AppError(503, "PUBLIC_MEDIA_UNAVAILABLE", "Published news media is temporarily unavailable."); return media;
}
function publicBlocks(blocks: NewsContentBlock[], map: Map<string, MediaDocument>, storageProvider: StorageProvider): PublicNewsContentBlock[] {
  return blocks.map((block) => {
    const parsed = newsContentBlockSchema.parse(block);
    if (parsed.type === "image" || parsed.type === "video") {
      const { mediaId, ...presentation } = parsed;
      return {
        ...presentation,
        media: publicMedia(requireMedia(mediaId, map), storageProvider),
      };
    }
    if (parsed.type === "document") { const { mediaId, ...rest } = parsed; return { ...rest, media: publicMedia(requireMedia(mediaId, map), storageProvider) }; }
    return parsed as PublicNewsContentBlock;
  });
}
function publicContext(news: NewsDocument, locale: LocaleCode) {
  const global = news.publishedGlobal; const localized = news.publishedSnapshots.get(locale);
  if (news.status !== "published" || global === undefined || localized === undefined) throw new AppError(404, "NEWS_NOT_FOUND", "The news item was not found.");
  return { global, localized };
}
function summary(news: NewsDocument, locale: LocaleCode, map: Map<string, MediaDocument>, storageProvider: StorageProvider): PublicNewsSummaryDto {
  const { global, localized } = publicContext(news, locale);
  return { id: news._id.toString(), slug: global.slug, category: global.category, authorName: global.authorName, featured: global.featured, tags: [...global.tags],
    title: localized.data.title, excerpt: localized.data.excerpt,
    ...(global.heroMediaId === undefined ? {} : { heroMedia: publicMedia(requireMedia(global.heroMediaId.toString(), map), storageProvider) }),
    publishedAt: (news.firstPublishedAt ?? global.publishedAt).toISOString(), updatedAt: new Date(Math.max(global.publishedAt.getTime(), localized.publishedAt.getTime())).toISOString(),
    availableLocales: [...news.publishedSnapshots.keys()], };
}
function mediaIdsFor(news: NewsDocument, locale: LocaleCode): string[] {
  const { global, localized } = publicContext(news, locale); const ids: string[] = [];
  if (global.heroMediaId !== undefined) ids.push(global.heroMediaId.toString());
  if (localized.data.seo.openGraphMediaId !== undefined) ids.push(localized.data.seo.openGraphMediaId.toString());
  for (const block of localized.data.content) if (block.type === "image" || block.type === "video" || block.type === "document") ids.push(block.mediaId);
  return ids;
}
export async function listPublicNews(query: PublicNewsListQuery, storageProvider: StorageProvider): Promise<PublicNewsListDto> {
  await requireLanguage(query.locale);
  const filter: QueryFilter<NewsDocument> = { status: "published", [`publishedSnapshots.${query.locale}`]: { $exists: true } };
  if (query.category !== undefined) filter["publishedGlobal.category"] = query.category;
  if (query.tag !== undefined) filter["publishedGlobal.tags"] = query.tag.toLowerCase();
  if (query.featured !== undefined) filter["publishedGlobal.featured"] = query.featured;
  if (query.search !== undefined) { const search = escapedRegex(query.search); filter.$or = [{ [`publishedSnapshots.${query.locale}.data.title`]: { $regex: search, $options: "i" } }, { [`publishedSnapshots.${query.locale}.data.excerpt`]: { $regex: search, $options: "i" } }]; }
  const [items, total, categories] = await Promise.all([
    NewsModel.find(filter).sort({ "publishedGlobal.featured": -1, "publishedGlobal.publishedAt": -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    NewsModel.countDocuments(filter), NewsModel.distinct("publishedGlobal.category", { status: "published", [`publishedSnapshots.${query.locale}`]: { $exists: true } }),
  ]);
  const map = await mediaMap(items.flatMap((item) => mediaIdsFor(item, query.locale)));
  return { items: items.map((item) => summary(item, query.locale, map, storageProvider)), categories: categories.sort(), pagination: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
}
export async function getPublicNews(slug: string, locale: LocaleCode, storageProvider: StorageProvider): Promise<PublicNewsDetailDto> {
  await requireLanguage(locale);
  const news = await NewsModel.findOne({ status: "published", "publishedGlobal.slug": slug, [`publishedSnapshots.${locale}`]: { $exists: true } });
  if (news === null) throw new AppError(404, "NEWS_NOT_FOUND", "The news item was not found.");
  const { localized } = publicContext(news, locale); const map = await mediaMap(mediaIdsFor(news, locale));
  const blocks = publicBlocks(localized.data.content, map, storageProvider);
  const words = blocks.reduce((count, block) => count + ("text" in block ? block.text.split(/\s+/).length : block.type === "list" ? block.items.join(" ").split(/\s+/).length : 0), 0);
  const seoMediaId = localized.data.seo.openGraphMediaId?.toString();
  const seo = outputSeo(localized.data.seo); const publicSeo = { ...seo }; delete publicSeo.openGraphMediaId;
  return { ...summary(news, locale, map, storageProvider), content: blocks, seo: { ...publicSeo, ...(seoMediaId === undefined ? {} : { openGraphMedia: publicMedia(requireMedia(seoMediaId, map), storageProvider) }) }, readingMinutes: Math.max(1, Math.ceil(words / 220)) };
}

export async function newsMediaUsages(mediaId: Types.ObjectId): Promise<Array<{ news: NewsDocument; locale?: string; placement: string; path: string }>> {
  const news = await NewsModel.find({});
  const result: Array<{ news: NewsDocument; locale?: string; placement: string; path: string }> = [];
  for (const item of news) {
    if (item.heroMediaId?.equals(mediaId) || item.publishedGlobal?.heroMediaId?.equals(mediaId)) result.push({ news: item, placement: "News hero", path: "heroMediaId" });
    for (const [locale, translation] of item.translations) {
      if (translation.seo.openGraphMediaId?.equals(mediaId)) result.push({ news: item, locale, placement: "News Open Graph image", path: `translations.${locale}.seo.openGraphMediaId` });
      translation.content.forEach((block, index) => { if ((block.type === "image" || block.type === "video" || block.type === "document") && block.mediaId === mediaId.toString()) result.push({ news: item, locale, placement: `News ${block.type}`, path: `translations.${locale}.content.${index}.mediaId` }); });
    }
    for (const [locale, snapshot] of item.publishedSnapshots) {
      if (snapshot.data.seo.openGraphMediaId?.equals(mediaId)) result.push({ news: item, locale, placement: "Published news Open Graph image", path: `publishedSnapshots.${locale}.data.seo.openGraphMediaId` });
      snapshot.data.content.forEach((block, index) => { if ((block.type === "image" || block.type === "video" || block.type === "document") && block.mediaId === mediaId.toString()) result.push({ news: item, locale, placement: `Published news ${block.type}`, path: `publishedSnapshots.${locale}.data.content.${index}.mediaId` }); });
    }
  }
  return result;
}
