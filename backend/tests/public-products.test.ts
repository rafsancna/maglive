import { randomUUID } from "node:crypto";
import {
  apiErrorSchema,
  apiSuccessSchema,
  publicProductDetailDtoSchema,
  publicProductListDtoSchema,
  publicProductVisibilityDtoSchema,
  publicSitemapEntriesDtoSchema,
  type LocaleCode,
} from "@maglive/contracts";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createApp } from "../src/app.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../src/config/database.js";
import { CategoryModel, type CategoryDocument } from "../src/models/Category.js";
import { MediaModel, type MediaDocument } from "../src/models/Media.js";
import {
  ProductModel,
  type PublishedProductGlobalMediaUsage,
  type PublishedProductLocale,
  type PublishedProductLocaleMediaUsage,
} from "../src/models/Product.js";
import type {
  SaveObjectInput,
  StorageProvider,
  StoredObject,
} from "../src/storage/StorageProvider.js";
import { createTestConfig } from "./helpers/config.js";

const actorId = new Types.ObjectId();
const publishedAt = new Date("2026-08-26T09:00:00.000Z");
let replicaSet: MongoMemoryReplSet;
let mongoUri: string;
let seededCatalog: Catalog;

class TestStorageProvider implements StorageProvider {
  readonly id = "local" as const;

  async save(_input: SaveObjectInput): Promise<StoredObject> {
    throw new Error("Public reads cannot write storage.");
  }

  async delete(_key: string): Promise<void> {
    throw new Error("Public reads cannot delete storage.");
  }

  async exists(_key: string): Promise<boolean> {
    return true;
  }

  getPublicUrl(key: string): string {
    return `https://media.example.test/${key}`;
  }
}

const storageProvider = new TestStorageProvider();

type Catalog = Readonly<{
  root: CategoryDocument;
  modules: CategoryDocument;
  inverters: CategoryDocument;
  hero: MediaDocument;
  gallery: MediaDocument;
  icon: MediaDocument;
  poster: MediaDocument;
  video: MediaDocument;
  document: MediaDocument;
}>;

function categoryLocaleSnapshot(
  name: string,
  globalRevision: string,
) {
  return {
    sourceVersion: 0,
    sourceHash: "b".repeat(64),
    globalRevision,
    publicationRevision: randomUUID(),
    publishedAt,
    data: { name, seo: { title: name } },
  };
}

async function createPublishedCategory(
  slug: string,
  parentId: Types.ObjectId | null,
  locales: readonly LocaleCode[] = ["en", "zh"],
): Promise<CategoryDocument> {
  const globalRevision = randomUUID();
  return CategoryModel.create({
    slug,
    parentId,
    sortOrder: 0,
    translations: new Map([
      ["en", { name: `${slug} working`, seo: {} }],
      ["zh", { name: `${slug} working zh`, seo: {} }],
    ]),
    publishedGlobal: {
      sourceVersion: 0,
      sourceHash: "a".repeat(64),
      globalRevision,
      publishedAt,
      data: { slug, parentId, sortOrder: 0 },
    },
    publishedSnapshots: new Map(
      locales.map((locale) => [
        locale,
        categoryLocaleSnapshot(
          locale === "en" ? `${slug} published` : `${slug}å·²å‘å¸ƒ`,
          globalRevision,
        ),
      ]),
    ),
    status: "active",
    firstPublishedAt: publishedAt,
    createdBy: actorId,
    updatedBy: actorId,
  });
}

async function createMedia(
  kind: "image" | "video" | "document",
  key: string,
  extra: Record<string, unknown> = {},
): Promise<MediaDocument> {
  return MediaModel.create({
    kind,
    storage: { provider: "local", key },
    originalName: key,
    mimeType:
      kind === "image"
        ? "image/webp"
        : kind === "video"
          ? "video/mp4"
          : "application/pdf",
    sizeBytes: 1_024,
    checksum: key.padEnd(64, "a").slice(0, 64),
    defaultTranslations: new Map(),
    status: "ready",
    uploadedBy: actorId,
    ...extra,
  });
}

async function createCatalog(): Promise<Catalog> {
  const root = await createPublishedCategory("solar", null);
  const modules = await createPublishedCategory("modules", root._id);
  const inverters = await createPublishedCategory("inverters", root._id);
  const hero = await createMedia("image", "hero.webp", {
    width: 1_600,
    height: 900,
    defaultTranslations: new Map([
      ["zh", { title: "é»˜è®¤ä¸­æ–‡æ ‡é¢˜" }],
    ]),
  });
  const gallery = await createMedia("image", "gallery.webp", {
    width: 1_200,
    height: 900,
  });
  const icon = await createMedia("image", "icon.webp", {
    width: 64,
    height: 64,
  });
  const poster = await createMedia("image", "poster.webp", {
    width: 1_280,
    height: 720,
  });
  const video = await createMedia("video", "overview.mp4", {
    durationSeconds: 42,
    posterMediaId: poster._id,
  });
  const document = await createMedia("document", "datasheet.pdf");
  return {
    root,
    modules,
    inverters,
    hero,
    gallery,
    icon,
    poster,
    video,
    document,
  };
}

function localizedSpecifications(locale: LocaleCode) {
  return [
    {
      key: "mechanical",
      label: locale === "en" ? "Mechanical" : "æœºæ¢°å‚æ•°",
      items: [
        {
          key: "weight",
          label: locale === "en" ? "Weight" : "é‡é‡",
        },
      ],
    },
    {
      key: "electrical",
      label: locale === "en" ? "Electrical" : "ç”µæ°”å‚æ•°",
      items: [
        {
          key: "power",
          label: locale === "en" ? "Power" : "åŠŸçŽ‡",
          ...(locale === "zh" ? { valueOverride: "å…­ç™¾ä¸‰å" } : {}),
        },
        {
          key: "current",
          label: locale === "en" ? "Current" : "ç”µæµ",
          note: locale === "en" ? "At STC" : "æ ‡å‡†æµ‹è¯•æ¡ä»¶",
        },
      ],
    },
  ];
}

function sharedSpecifications() {
  return [
    {
      key: "mechanical",
      order: 20,
      items: [{ key: "weight", order: 0, value: "32", unit: "kg" }],
    },
    {
      key: "electrical",
      order: 10,
      items: [
        { key: "power", order: 20, value: "630", unit: "W" },
        { key: "current", order: 10, value: "15", unit: "A" },
      ],
    },
  ];
}

function richMediaUsages(
  catalog: Catalog,
  locale: LocaleCode,
): PublishedProductLocaleMediaUsage[] {
  const shared: PublishedProductLocaleMediaUsage[] = [
    {
      mediaId: catalog.hero._id,
      role: "hero",
      order: 10,
      alt: locale === "en" ? "Published English hero" : "å·²å‘å¸ƒä¸­æ–‡ä¸»å›¾",
      ...(locale === "en"
        ? { title: "English contextual title", caption: "English caption" }
        : {}),
    },
    {
      mediaId: catalog.gallery._id,
      role: "gallery",
      order: 5,
      alt: locale === "en" ? "English gallery" : "ä¸­æ–‡ç”»å»Š",
    },
    {
      mediaId: catalog.video._id,
      role: "video",
      order: 20,
      title: locale === "en" ? "Overview video" : "äº§å“è§†é¢‘",
    },
  ];
  return locale === "zh"
    ? [
        ...shared,
        {
          mediaId: catalog.document._id,
          role: "datasheet",
          order: 30,
          locale: "zh",
          title: "ä¸­æ–‡æ•°æ®è¡¨",
        },
      ]
    : shared;
}

async function createPublishedProduct(
  catalog: Catalog,
  options: {
    slug: string;
    categoryId: Types.ObjectId;
    displayOrder: number;
    locales?: readonly LocaleCode[];
    featured?: boolean;
    rich?: boolean;
    status?: "draft" | "published" | "archived" | "deleting";
    mismatchLocale?: LocaleCode;
  },
) {
  const locales = options.locales ?? (["en", "zh"] as const);
  const rich = options.rich === true;
  const globalRevision = randomUUID();
  const globalMedia: PublishedProductGlobalMediaUsage[] = rich
    ? [
        { mediaId: catalog.hero._id, role: "hero", order: 10 },
        {
          mediaId: catalog.document._id,
          role: "datasheet",
          order: 30,
          locale: "zh",
        },
        { mediaId: catalog.gallery._id, role: "gallery", order: 5 },
        { mediaId: catalog.video._id, role: "video", order: 20 },
      ]
    : [{ mediaId: catalog.gallery._id, role: "gallery", order: 0 }];
  const snapshots = new Map<string, PublishedProductLocale>(
    locales.map((locale) => [
      locale,
      {
        sourceVersion: 0,
        sourceHash: locale === "en" ? "c".repeat(64) : "d".repeat(64),
        globalRevision:
          options.mismatchLocale === locale ? randomUUID() : globalRevision,
        publicationRevision: randomUUID(),
        publishedAt: new Date(
          locale === "en"
            ? "2026-08-26T09:00:00.000Z"
            : "2026-08-26T10:00:00.000Z",
        ),
        data: {
          name:
            locale === "en"
              ? `${options.slug} published`
              : `${options.slug}ä¸­æ–‡å·²å‘å¸ƒ`,
          shortDescription:
            locale === "en" ? "Published English summary." : "å·²å‘å¸ƒä¸­æ–‡ç®€ä»‹ã€‚",
          ...(locale === "en"
            ? {
                longDescriptionMarkdown: "Published English long copy.",
                warrantyInformation: "Published English warranty.",
              }
            : {}),
          features: rich
            ? [
                {
                  key: "efficiency",
                  title: locale === "en" ? "Efficiency" : "é«˜æ•ˆçŽ‡",
                  iconMediaId: catalog.icon._id,
                },
              ]
            : [],
          advantages: [],
          applications: [],
          seo: {
            title:
              locale === "en" ? "Published SEO" : "å·²å‘å¸ƒä¸­æ–‡ SEO",
            description:
              locale === "en"
                ? "Published SEO description."
                : "å·²å‘å¸ƒä¸­æ–‡ SEO æè¿°ã€‚",
            keywords: [],
            ...(locale === "en" && rich
              ? {
                  openGraphTitle: "Published English OpenGraph",
                  openGraphDescription: "Published English OpenGraph copy.",
                  openGraphMediaId: catalog.hero._id,
                }
              : {}),
          },
          specifications: localizedSpecifications(locale),
          mediaUsages: rich
            ? richMediaUsages(catalog, locale)
            : [
                {
                  mediaId: catalog.gallery._id,
                  role: "gallery",
                  order: 0,
                  alt: locale === "en" ? "Related image" : "ç›¸å…³äº§å“å›¾ç‰‡",
                },
              ],
        },
      },
    ]),
  );
  return ProductModel.create({
    slug: options.slug,
    categoryId: options.categoryId,
    model: `WORKING-${options.slug}`,
    translations: new Map([
      [
        "en",
        {
          name: "WORKING SECRET ENGLISH NAME",
          shortDescription: "WORKING SECRET DESCRIPTION",
          features: [],
          advantages: [],
          applications: [],
          seo: {},
        },
      ],
      [
        "zh",
        {
          name: "WORKING SECRET CHINESE NAME",
          shortDescription: "WORKING SECRET CHINESE DESCRIPTION",
          features: [],
          advantages: [],
          applications: [],
          seo: {},
        },
      ],
    ]),
    specifications: [],
    mediaUsages: [],
    pageTemplate: "standard",
    displayOrder: 999,
    featured: false,
    publishedGlobal: {
      sourceVersion: 0,
      sourceHash: "e".repeat(64),
      globalRevision,
      publishedAt,
      data: {
        slug: options.slug,
        categoryId: options.categoryId,
        model: `PUBLISHED-${options.slug}`,
        series: "Published series",
        specifications: sharedSpecifications(),
        mediaUsages: globalMedia,
        pageTemplate: "standard",
        displayOrder: options.displayOrder,
        featured: options.featured ?? false,
      },
    },
    publishedSnapshots: snapshots,
    status: options.status ?? "published",
    firstPublishedAt: publishedAt,
    createdBy: actorId,
    updatedBy: actorId,
  });
}

async function seedPublishedCatalog(): Promise<Catalog> {
  const catalog = await createCatalog();
  await createPublishedProduct(catalog, {
    slug: "main-module",
    categoryId: catalog.modules._id,
    displayOrder: 20,
    featured: true,
    rich: true,
  });
  await createPublishedProduct(catalog, {
    slug: "related-module",
    categoryId: catalog.modules._id,
    displayOrder: 10,
  });
  await createPublishedProduct(catalog, {
    slug: "hybrid-inverter",
    categoryId: catalog.inverters._id,
    displayOrder: 15,
  });
  await createPublishedProduct(catalog, {
    slug: "english-only",
    categoryId: catalog.modules._id,
    displayOrder: 5,
    locales: ["en"],
  });
  return catalog;
}

function app() {
  return createApp({
    config: createTestConfig({ mongoUri }),
    storageProvider,
  });
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  mongoUri = replicaSet.getUri("maglive_public_products_test");
  await connectDatabase(mongoUri);
  await Promise.all([
    CategoryModel.syncIndexes(),
    MediaModel.syncIndexes(),
    ProductModel.syncIndexes(),
  ]);
}, 180_000);

beforeEach(async () => {
  await Promise.all([
    CategoryModel.deleteMany({}),
    MediaModel.deleteMany({}),
    ProductModel.deleteMany({}),
    mongoose.connection.collection("admin_sessions").deleteMany({}),
  ]);
  seededCatalog = await seedPublishedCatalog();
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("public localized Product APIs", () => {
  it("lists only coherent locale snapshots with bounded filters, sorting, and pagination", async () => {
    const response = await request(app())
      .get("/api/v1/public/products")
      .query({ locale: "zh", category: "modules", page: 1, limit: 1 })
      .expect(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const data = apiSuccessSchema(publicProductListDtoSchema).parse(
      response.body,
    ).data;
    expect(data.pagination).toEqual({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
    expect(data.items[0]?.slug).toBe("related-module");
    expect(data.items[0]?.model).toBe("PUBLISHED-related-module");
    expect(data.items[0]?.category.breadcrumbs).toHaveLength(2);
    expect(data.items[0]?.primaryMedia?.url).toBe(
      "https://media.example.test/gallery.webp",
    );

    const finalPage = apiSuccessSchema(publicProductListDtoSchema).parse(
      (
        await request(app())
          .get("/api/v1/public/products")
          .query({ locale: "zh", category: "solar", page: 2, limit: 2 })
          .expect(200)
      ).body,
    ).data;
    expect(finalPage.pagination.total).toBe(3);
    expect(finalPage.items).toHaveLength(1);

    const featured = apiSuccessSchema(publicProductListDtoSchema).parse(
      (
        await request(app())
          .get("/api/v1/public/products")
          .query({ locale: "zh", featured: "true" })
          .expect(200)
      ).body,
    ).data;
    expect(featured.items.map((item) => item.slug)).toEqual(["main-module"]);
    const serialized = JSON.stringify(featured);
    expect(serialized).not.toContain("WORKING SECRET");
    expect(serialized).not.toContain("publishedSnapshots");
    expect(serialized).not.toContain("storage");
  });

  it("uses a no-store revision gate and composes detail only from published snapshots", async () => {
    const visibilityResponse = await request(app())
      .get("/api/v1/public/products/main-module/visibility")
      .query({ locale: "zh" })
      .expect(200);
    expect(visibilityResponse.headers["cache-control"]).toBe("no-store");
    const visibility = apiSuccessSchema(
      publicProductVisibilityDtoSchema,
    ).parse(visibilityResponse.body).data;
    expect(visibility.availableLocales).toEqual(["en", "zh"]);

    const detailResponse = await request(app())
      .get("/api/v1/public/products/main-module")
      .query({
        locale: "zh",
        publicationRevision: visibility.publicationRevision,
      })
      .expect(200);
    const detail = apiSuccessSchema(publicProductDetailDtoSchema).parse(
      detailResponse.body,
    ).data;
    expect(detail.name).toBe("main-moduleä¸­æ–‡å·²å‘å¸ƒ");
    expect(detail.model).toBe("PUBLISHED-main-module");
    expect(detail.longDescriptionMarkdown).toBe(
      "Published English long copy.",
    );
    expect(detail.warrantyInformation).toBe(
      "Published English warranty.",
    );
    expect(detail.fallbackFields).toEqual(
      expect.arrayContaining([
        "longDescriptionMarkdown",
        "warrantyInformation",
        "seo.openGraphTitle",
        "seo.openGraphDescription",
        "seo.openGraphMedia",
      ]),
    );
    expect(detail.specifications.map((group) => group.key)).toEqual([
      "electrical",
      "mechanical",
    ]);
    expect(
      detail.specifications[0]?.items.map((item) => item.key),
    ).toEqual(["current", "power"]);
    expect(detail.specifications[0]?.items[1]?.value).toBe("å…­ç™¾ä¸‰å");
    expect(detail.media.map((media) => media.order)).toEqual([5, 10, 20, 30]);
    expect(detail.media[1]?.title).toBe("é»˜è®¤ä¸­æ–‡æ ‡é¢˜");
    expect(detail.media[1]?.caption).toBe("English caption");
    expect(detail.media[2]?.poster?.url).toBe(
      "https://media.example.test/poster.webp",
    );
    expect(detail.features[0]?.iconMedia?.url).toBe(
      "https://media.example.test/icon.webp",
    );
    expect(detail.seo.openGraphMedia?.url).toBe(
      "https://media.example.test/hero.webp",
    );
    expect(detail.relatedProducts.map((item) => item.slug)).toEqual([
      "related-module",
    ]);
    const serialized = JSON.stringify(detail);
    for (const privateValue of [
      "WORKING SECRET",
      "publishedSnapshots",
      "publishedGlobal",
      "createdBy",
      "updatedBy",
      "storage",
      "checksum",
      "originalName",
    ]) {
      expect(serialized).not.toContain(privateValue);
    }
  });

  it("returns a conflict for obsolete revisions and accepts the newly gated revision", async () => {
    const firstVisibility = apiSuccessSchema(
      publicProductVisibilityDtoSchema,
    ).parse(
      (
        await request(app())
          .get("/api/v1/public/products/main-module/visibility")
          .query({ locale: "en" })
          .expect(200)
      ).body,
    ).data;
    const replacement = randomUUID();
    await ProductModel.updateOne(
      { slug: "main-module" },
      { $set: { "publishedSnapshots.en.publicationRevision": replacement } },
    );
    const conflict = await request(app())
      .get("/api/v1/public/products/main-module")
      .query({
        locale: "en",
        publicationRevision: firstVisibility.publicationRevision,
      })
      .expect(409);
    expect(apiErrorSchema.parse(conflict.body).error.code).toBe(
      "PUBLICATION_REVISION_CHANGED",
    );
    const nextVisibility = apiSuccessSchema(
      publicProductVisibilityDtoSchema,
    ).parse(
      (
        await request(app())
          .get("/api/v1/public/products/main-module/visibility")
          .query({ locale: "en" })
          .expect(200)
      ).body,
    ).data;
    expect(nextVisibility.publicationRevision).toBe(replacement);
    await request(app())
      .get("/api/v1/public/products/main-module")
      .query({ locale: "en", publicationRevision: replacement })
      .expect(200);
  });

  it("does not reveal draft, archived, deleting, missing-locale, or incoherent products", async () => {
    const catalog = seededCatalog;
    for (const [slug, status] of [
      ["draft-hidden", "draft"],
      ["archived-hidden", "archived"],
      ["deleting-hidden", "deleting"],
    ] as const) {
      await createPublishedProduct(catalog, {
        slug,
        categoryId: catalog.modules._id,
        displayOrder: 0,
        status,
      });
    }
    await createPublishedProduct(catalog, {
      slug: "missing-zh",
      categoryId: catalog.modules._id,
      displayOrder: 0,
      locales: ["en"],
    });
    await createPublishedProduct(catalog, {
      slug: "mismatched-zh",
      categoryId: catalog.modules._id,
      displayOrder: 0,
      mismatchLocale: "zh",
    });
    for (const slug of [
      "draft-hidden",
      "archived-hidden",
      "deleting-hidden",
      "missing-zh",
      "mismatched-zh",
      "absent-product",
    ]) {
      const response = await request(app())
        .get(`/api/v1/public/products/${slug}/visibility`)
        .query({ locale: "zh" })
        .expect(404);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        "PRODUCT_NOT_FOUND",
      );
    }
    const list = apiSuccessSchema(publicProductListDtoSchema).parse(
      (
        await request(app())
          .get("/api/v1/public/products")
          .query({ locale: "zh" })
          .expect(200)
      ).body,
    ).data;
    expect(list.items.map((item) => item.slug)).not.toEqual(
      expect.arrayContaining([
        "draft-hidden",
        "archived-hidden",
        "deleting-hidden",
        "missing-zh",
        "mismatched-zh",
      ]),
    );
  });

  it("hides products when a root or leaf category is unavailable for the locale", async () => {
    const root = await CategoryModel.findOne({ slug: "solar" }).orFail();
    const leaf = await CategoryModel.findOne({ slug: "modules" }).orFail();
    const leafChineseSnapshot = leaf.publishedSnapshots.get("zh");
    if (leafChineseSnapshot === undefined) {
      throw new Error("Missing Chinese leaf-category fixture.");
    }

    await CategoryModel.updateOne({ _id: root._id }, { $set: { status: "archived" } });
    await request(app())
      .get("/api/v1/public/products/main-module/visibility")
      .query({ locale: "zh" })
      .expect(404);

    await CategoryModel.updateOne({ _id: root._id }, { $set: { status: "deleting" } });
    await request(app())
      .get("/api/v1/public/products/main-module/visibility")
      .query({ locale: "zh" })
      .expect(404);

    await CategoryModel.updateOne({ _id: root._id }, { $set: { status: "active" } });
    await CategoryModel.updateOne({ _id: leaf._id }, { $set: { status: "archived" } });
    await request(app())
      .get("/api/v1/public/products/main-module/visibility")
      .query({ locale: "zh" })
      .expect(404);

    await CategoryModel.updateOne({ _id: leaf._id }, { $set: { status: "deleting" } });
    await request(app())
      .get("/api/v1/public/products/main-module/visibility")
      .query({ locale: "zh" })
      .expect(404);

    await CategoryModel.updateOne({ _id: leaf._id }, { $set: { status: "active" } });
    await CategoryModel.updateOne(
      { _id: leaf._id },
      { $unset: { "publishedSnapshots.zh": 1 } },
    );
    await request(app())
      .get("/api/v1/public/products/main-module/visibility")
      .query({ locale: "zh" })
      .expect(404);

    await CategoryModel.updateOne(
      { _id: leaf._id },
      { $set: { "publishedSnapshots.zh": leafChineseSnapshot } },
    );
    await CategoryModel.updateOne(
      { _id: root._id },
      { $unset: { "publishedSnapshots.zh": 1 } },
    );
    await request(app())
      .get("/api/v1/public/products/main-module/visibility")
      .query({ locale: "zh" })
      .expect(404);
  });

  it("returns published-only paginated category/product sitemap locale pairs", async () => {
    const first = await request(app())
      .get("/api/v1/public/sitemap-entries")
      .query({ page: 1, limit: 5 })
      .expect(200);
    expect(first.headers["cache-control"]).toBe("no-store");
    const firstPage = apiSuccessSchema(publicSitemapEntriesDtoSchema).parse(
      first.body,
    ).data;
    expect(firstPage.pagination).toEqual({
      page: 1,
      limit: 5,
      total: 13,
      totalPages: 3,
    });
    const lastPage = apiSuccessSchema(publicSitemapEntriesDtoSchema).parse(
      (
        await request(app())
          .get("/api/v1/public/sitemap-entries")
          .query({ page: 3, limit: 5 })
          .expect(200)
      ).body,
    ).data;
    expect(lastPage.items).toHaveLength(3);
    const all = [...firstPage.items];
    for (const page of [2, 3]) {
      all.push(
        ...apiSuccessSchema(publicSitemapEntriesDtoSchema).parse(
          (
            await request(app())
              .get("/api/v1/public/sitemap-entries")
              .query({ page, limit: 5 })
              .expect(200)
          ).body,
        ).data.items,
      );
    }
    expect(all.some((item) => item.path === "/zh/products/main-module")).toBe(
      true,
    );
    expect(
      all.some((item) => item.path === "/zh/products/english-only"),
    ).toBe(false);
    expect(all.every((item) => item.updatedAt.endsWith("Z"))).toBe(true);
  });

  it("rejects unsupported public query keys and reports unavailable snapshot media", async () => {
    for (const path of [
      "/api/v1/public/products?locale=en&limit=101",
      "/api/v1/public/products?locale=en&includeDraft=true",
      "/api/v1/public/products/main-module?locale=en",
      "/api/v1/public/products/main-module?locale=en&publicationRevision=bad",
      "/api/v1/public/sitemap-entries?unknown=true",
    ]) {
      const response = await request(app()).get(path).expect(422);
      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        "VALIDATION_FAILED",
      );
    }

    const unsupportedLocale = await request(app())
      .get("/api/v1/public/products?locale=de")
      .expect(422);
    expect(apiErrorSchema.parse(unsupportedLocale.body).error.code).toBe(
      "UNSUPPORTED_LOCALE",
    );

    await MediaModel.deleteOne({ "storage.key": "hero.webp" });
    const visibility = apiSuccessSchema(
      publicProductVisibilityDtoSchema,
    ).parse(
      (
        await request(app())
          .get("/api/v1/public/products/main-module/visibility")
          .query({ locale: "en" })
          .expect(200)
      ).body,
    ).data;
    const unavailable = await request(app())
      .get("/api/v1/public/products/main-module")
      .query({
        locale: "en",
        publicationRevision: visibility.publicationRevision,
      })
      .expect(503);
    expect(apiErrorSchema.parse(unavailable.body).error.code).toBe(
      "PUBLIC_MEDIA_UNAVAILABLE",
    );
  });
});
