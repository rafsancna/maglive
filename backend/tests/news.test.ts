import { randomUUID } from "node:crypto";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { NewsModel } from "../src/models/News.js";
import {
  archiveNews,
  createNews,
  getPublicNews,
  listPublicNews,
  publishNews,
  updateNews,
} from "../src/services/newsService.js";
import { LocalStorageProvider } from "../src/storage/LocalStorageProvider.js";
import type { CreateNewsRequest } from "@maglive/contracts";

let replicaSet: MongoMemoryReplSet;
const actor = { id: new Types.ObjectId().toString() };
const storage = new LocalStorageProvider(
  path.resolve(".data/news-test"),
  "http://localhost:5000/uploads",
);

function translation(title: string): NonNullable<CreateNewsRequest["translations"]["en"]> {
  return {
    title,
    excerpt: `${title} summary for search and listing cards.`,
    content: [
      { id: randomUUID(), type: "heading" as const, level: 2 as const, text: "News details" },
      { id: randomUUID(), type: "paragraph" as const, text: `${title} full newsroom content.` },
      { id: randomUUID(), type: "link" as const, label: "Company website", url: "https://example.com/news", newWindow: true },
    ],
    seo: { title, description: `${title} SEO description.`, keywords: ["energy", "update"] },
  };
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  await connectDatabase(replicaSet.getUri("maglive_news_test"));
  await NewsModel.syncIndexes();
}, 180_000);
beforeEach(async () => { await NewsModel.deleteMany({}); });
afterAll(async () => { await disconnectDatabase(); await replicaSet.stop(); }, 60_000);

describe.sequential("news publishing", () => {
  it("keeps drafts private and publishes independent multilingual snapshots", async () => {
    let news = await createNews({
      slug: "solar-expansion", category: "company-news", authorName: "Maglive Newsroom", featured: true, tags: ["Solar", "Growth"],
      translations: { en: translation("Solar expansion"), zh: translation("太阳能扩建") },
    }, actor);
    expect(news.status).toBe("draft");
    await expect(getPublicNews(news.slug, "en", storage)).rejects.toMatchObject({ status: 404 });

    news = await publishNews(news.id, { version: news.version, locales: ["en"] }, actor);
    expect(news.localeStates.en).toBe("published");
    expect(news.localeStates.zh).toBe("draft");
    expect((await getPublicNews(news.slug, "en", storage)).title).toBe("Solar expansion");
    await expect(getPublicNews(news.slug, "zh", storage)).rejects.toMatchObject({ status: 404 });

    const revisedEnglish = translation("Solar expansion");
    revisedEnglish.content[1] = { ...revisedEnglish.content[1]!, type: "paragraph", text: "Revised working content that is not public yet." };
    news = await updateNews(news.id, { version: news.version, translations: { ...news.translations, en: revisedEnglish } }, actor);
    expect(news.localeStates.en).toBe("changes-pending");
    expect((await getPublicNews(news.slug, "en", storage)).content).not.toContainEqual(expect.objectContaining({ text: "Revised working content that is not public yet." }));

    news = await publishNews(news.id, { version: news.version, locales: ["en", "zh"] }, actor);
    expect((await getPublicNews(news.slug, "en", storage)).content).toContainEqual(expect.objectContaining({ text: "Revised working content that is not public yet." }));
    expect((await getPublicNews(news.slug, "zh", storage)).title).toBe("太阳能扩建");
    const listing = await listPublicNews({ locale: "en", page: 1, limit: 20 }, storage);
    expect(listing.items).toHaveLength(1);
    expect(listing.items[0]).toMatchObject({ featured: true, tags: ["solar", "growth"] });
  });

  it("rejects unavailable block media and hides archived news", async () => {
    const invalid = translation("Invalid media");
    invalid.content.push({ id: randomUUID(), type: "image", mediaId: new Types.ObjectId().toString() });
    await expect(createNews({ slug: "invalid-media", category: "product-news", authorName: "Newsroom", featured: false, tags: [], translations: { en: invalid } }, actor))
      .rejects.toMatchObject({ code: "NEWS_MEDIA_NOT_READY" });

    let news = await createNews({ slug: "archive-me", category: "industry-news", authorName: "Newsroom", featured: false, tags: [], translations: { en: translation("Archive me") } }, actor);
    news = await publishNews(news.id, { version: news.version, locales: ["en"] }, actor);
    news = await archiveNews(news.id, news.version, actor);
    expect(news.status).toBe("archived");
    await expect(getPublicNews(news.slug, "en", storage)).rejects.toMatchObject({ status: 404 });
  });
});
