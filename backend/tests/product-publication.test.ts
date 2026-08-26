import { randomUUID } from "node:crypto";
import type { LocaleCode } from "@maglive/contracts";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  connectDatabase,
  disconnectDatabase,
} from "../src/config/database.js";
import {
  buildProductGlobalProjection,
  buildProductLocaleProjection,
  hashCanonicalValue,
  validateProductUnpublication,
} from "../src/domain/productPublication.js";
import { AppError } from "../src/errors/AppError.js";
import { CategoryModel, type CategoryDocument } from "../src/models/Category.js";
import { MediaModel, type MediaDocument } from "../src/models/Media.js";
import {
  ProductModel,
  toProductAdminDto,
  type Product,
  type ProductDocument,
} from "../src/models/Product.js";
import {
  publishProduct,
  validateProductPublication,
} from "../src/services/publishingService.js";

let replicaSet: MongoMemoryReplSet;
const actorId = new Types.ObjectId();

type ProductSeed = Omit<
  Product,
  | "publishedGlobal"
  | "publishedSnapshots"
  | "status"
  | "firstPublishedAt"
  | "createdAt"
  | "updatedAt"
  | "version"
>;

function categorySnapshot(locale: LocaleCode, globalRevision: string) {
  return {
    sourceVersion: 0,
    sourceHash: locale === "en" ? "b".repeat(64) : "c".repeat(64),
    globalRevision,
    publicationRevision: randomUUID(),
    publishedAt: new Date("2026-08-26T09:00:00.000Z"),
    data: {
      name: locale === "en" ? "Solar products" : "太阳能产品",
      seo: { title: locale === "en" ? "Solar products" : "太阳能产品" },
    },
  };
}

async function createPublishedCategory(
  slug: string,
  parentId: Types.ObjectId | null,
): Promise<CategoryDocument> {
  const globalRevision = randomUUID();
  return CategoryModel.create({
    slug,
    parentId,
    sortOrder: 0,
    translations: new Map([
      ["en", { name: "Solar products", seo: {} }],
      ["zh", { name: "太阳能产品", seo: {} }],
    ]),
    publishedGlobal: {
      sourceVersion: 0,
      sourceHash: "a".repeat(64),
      globalRevision,
      publishedAt: new Date("2026-08-26T09:00:00.000Z"),
      data: { slug, parentId, sortOrder: 0 },
    },
    publishedSnapshots: new Map([
      ["en", categorySnapshot("en", globalRevision)],
      ["zh", categorySnapshot("zh", globalRevision)],
    ]),
    status: "active",
    firstPublishedAt: new Date("2026-08-26T09:00:00.000Z"),
    createdBy: actorId,
    updatedBy: actorId,
  });
}

async function createCatalog(): Promise<{
  root: CategoryDocument;
  leaf: CategoryDocument;
  hero: MediaDocument;
}> {
  const root = await createPublishedCategory("solar", null);
  const leaf = await createPublishedCategory("modules", root._id);
  const hero = await MediaModel.create({
    kind: "image",
    storage: { provider: "local", key: `${randomUUID()}.webp` },
    originalName: "module.webp",
    mimeType: "image/webp",
    sizeBytes: 1_024,
    checksum: "f".repeat(64),
    width: 1200,
    height: 900,
    defaultTranslations: new Map(),
    status: "ready",
    uploadedBy: actorId,
  });
  return { root, leaf, hero };
}

function productSeed(
  categoryId: Types.ObjectId,
  heroMediaId?: Types.ObjectId,
  template: "standard" | "topcon-premium" = "topcon-premium",
): ProductSeed {
  return {
    slug: template === "standard" ? "x1-hybrid-inverter" : "630w-topcon",
    categoryId,
    model: template === "standard" ? "X1-HYBRID" : "MG-630N",
    series: template === "standard" ? "Hybrid" : "N-Type",
    translations: new Map([
      [
        "en",
        {
          name:
            template === "standard"
              ? "X1 hybrid inverter"
              : "630 W TOPCon module",
          shortDescription: "High-efficiency solar energy equipment.",
          longDescriptionMarkdown: "Engineered for reliable clean energy.",
          features: [],
          advantages: [],
          applications: [],
          seo: {},
        },
      ],
      [
        "zh",
        {
          name: template === "standard" ? "X1混合逆变器" : "630瓦TOPCon组件",
          shortDescription: "高效太阳能设备。",
          longDescriptionMarkdown: "为可靠的清洁能源而设计。",
          features: [],
          advantages: [],
          applications: [],
          seo: {},
        },
      ],
    ]),
    specifications:
      template === "standard"
        ? [
            {
              key: "dc-input",
              order: 0,
              translations: new Map([
                ["en", { label: "DC input" }],
                ["zh", { label: "直流输入" }],
              ]),
              items: [
                {
                  key: "maximum-voltage",
                  order: 0,
                  value: "1000",
                  unit: "V",
                  translations: new Map([
                    ["en", { label: "Maximum voltage" }],
                    ["zh", { label: "最大电压" }],
                  ]),
                },
              ],
            },
            {
              key: "ac-output",
              order: 1,
              translations: new Map([
                ["en", { label: "AC output" }],
                ["zh", { label: "交流输出" }],
              ]),
              items: [
                {
                  key: "rated-power",
                  order: 0,
                  value: "12",
                  unit: "kW",
                  translations: new Map([
                    ["en", { label: "Rated power" }],
                    ["zh", { label: "额定功率" }],
                  ]),
                },
              ],
            },
          ]
        : [
            {
              key: "electrical",
              order: 0,
              translations: new Map([
                ["en", { label: "Electrical characteristics" }],
                ["zh", { label: "电气参数" }],
              ]),
              items: [
                {
                  key: "maximum-power",
                  order: 0,
                  value: "630",
                  unit: "W",
                  translations: new Map([
                    ["en", { label: "Maximum power" }],
                    ["zh", { label: "最大功率" }],
                  ]),
                },
              ],
            },
          ],
    mediaUsages:
      heroMediaId === undefined
        ? []
        : [
            {
              mediaId: heroMediaId,
              role: "hero",
              order: 0,
              translations: new Map([
                ["en", { alt: "Solar product" }],
                ["zh", { alt: "太阳能产品" }],
              ]),
            },
          ],
    pageTemplate: template,
    displayOrder: 10,
    featured: true,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

async function createProduct(
  categoryId: Types.ObjectId,
  heroMediaId?: Types.ObjectId,
  template: "standard" | "topcon-premium" = "topcon-premium",
): Promise<ProductDocument> {
  return ProductModel.create({
    ...productSeed(categoryId, heroMediaId, template),
    publishedSnapshots: new Map(),
    status: "draft",
  });
}

async function validationReport(
  product: ProductDocument,
  locales: readonly LocaleCode[],
  promoteShared = false,
) {
  const session = await mongoose.startSession();
  try {
    let report: Awaited<ReturnType<typeof validateProductPublication>> | undefined;
    await session.withTransaction(async () => {
      report = await validateProductPublication(
        product,
        locales,
        promoteShared,
        session,
      );
    });
    if (report === undefined) throw new Error("Validation transaction failed.");
    return report;
  } finally {
    await session.endSession();
  }
}

function appErrorCodes(error: unknown): string[] {
  expect(error).toBeInstanceOf(AppError);
  return (error as AppError).details?.map((detail) => detail.code) ?? [];
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await connectDatabase(replicaSet.getUri("maglive_product_publication_test"));
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
  ]);
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("product publication validation and promotion", () => {
  it("saves incomplete working drafts without creating or changing public snapshots", async () => {
    const { leaf } = await createCatalog();
    const product = await createProduct(leaf._id, undefined, "standard");
    const english = product.translations.get("en");
    expect(english).toBeDefined();
    product.set("translations.en.shortDescription", undefined);
    await product.save();

    const report = await validationReport(product, ["en"]);
    expect(report.publishable).toBe(false);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "PRODUCT_SHORT_DESCRIPTION_REQUIRED",
          path: "translations.en.shortDescription",
        }),
      ]),
    );
    const stored = await ProductModel.findById(product._id).orFail();
    expect(stored.status).toBe("draft");
    expect(stored.publishedGlobal).toBeUndefined();
    expect(stored.publishedSnapshots.size).toBe(0);
    expect(toProductAdminDto(stored).localeStates.en).toBe("incomplete");
  });

  it("publishes English first, publishes Chinese independently, and derives split pending states", async () => {
    const { leaf, hero } = await createCatalog();
    let product = await createProduct(leaf._id, hero._id);

    await expect(
      publishProduct(
        product.id,
        { version: product.version, locales: ["zh"], promoteShared: false },
        { id: actorId.toString() },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      appErrorCodes(error).includes("DEFAULT_LOCALE_REQUIRED"),
    );

    const englishResult = await publishProduct(
      product.id,
      { version: product.version, locales: ["en"], promoteShared: false },
      { id: actorId.toString() },
    );
    expect(englishResult.product.sharedState).toBe("published");
    expect(englishResult.product.localeStates).toMatchObject({
      en: "published",
      zh: "draft",
    });
    expect(englishResult.product.publishedSnapshots.zh).toBeUndefined();
    const globalRevision = englishResult.product.publishedGlobal?.globalRevision;
    const englishRevision =
      englishResult.product.publishedSnapshots.en?.publicationRevision;

    product = await ProductModel.findById(product._id).orFail();
    const chinese = product.translations.get("zh");
    expect(chinese).toBeDefined();
    if (chinese !== undefined) chinese.name = "630瓦高效TOPCon组件";
    await product.save();
    let dto = toProductAdminDto(product);
    expect(dto.sharedState).toBe("published");
    expect(dto.localeStates.en).toBe("published");
    expect(dto.localeStates.zh).toBe("draft");

    const chineseResult = await publishProduct(
      product.id,
      { version: product.version, locales: ["zh"], promoteShared: false },
      { id: actorId.toString() },
    );
    expect(chineseResult.product.publishedGlobal?.globalRevision).toBe(
      globalRevision,
    );
    expect(
      chineseResult.product.publishedSnapshots.en?.publicationRevision,
    ).toBe(englishRevision);
    expect(chineseResult.product.localeStates).toMatchObject({
      en: "published",
      zh: "published",
    });

    product = await ProductModel.findById(product._id).orFail();
    const english = product.translations.get("en");
    expect(english).toBeDefined();
    if (english !== undefined) english.name = "630 W premium TOPCon module";
    await product.save();
    dto = toProductAdminDto(product);
    expect(dto.sharedState).toBe("published");
    expect(dto.localeStates.en).toBe("changes-pending");
    expect(dto.localeStates.zh).toBe("published");
    expect(dto.workingLocaleHashes.en).not.toBe(
      dto.publishedSnapshots.en?.sourceHash,
    );
    expect(dto.workingGlobalHash).toBe(dto.publishedGlobal?.sourceHash);
    expect(validateProductUnpublication(product, "en")[0]?.code).toBe(
      "DEFAULT_LOCALE_REQUIRED",
    );
  });

  it("requires explicit all-live shared promotion and rolls back every snapshot on invalid locale data", async () => {
    const { leaf, hero } = await createCatalog();
    let product = await createProduct(leaf._id, hero._id);
    await publishProduct(
      product.id,
      { version: product.version, locales: ["en"], promoteShared: false },
      { id: actorId.toString() },
    );
    product = await ProductModel.findById(product._id).orFail();
    await publishProduct(
      product.id,
      { version: product.version, locales: ["zh"], promoteShared: false },
      { id: actorId.toString() },
    );

    product = await ProductModel.findById(product._id).orFail();
    const originalGlobalRevision = product.publishedGlobal?.globalRevision;
    const originalEnglishRevision =
      product.publishedSnapshots.get("en")?.publicationRevision;
    const originalChineseRevision =
      product.publishedSnapshots.get("zh")?.publicationRevision;
    product.set("model", "MG-635N");
    const chinese = product.translations.get("zh");
    expect(chinese).toBeDefined();
    if (chinese !== undefined) chinese.shortDescription = "";
    await product.save();

    await expect(
      publishProduct(
        product.id,
        { version: product.version, locales: ["en"], promoteShared: false },
        { id: actorId.toString() },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      appErrorCodes(error).includes("SHARED_PROMOTION_REQUIRED"),
    );
    await expect(
      publishProduct(
        product.id,
        { version: product.version, locales: ["en"], promoteShared: true },
        { id: actorId.toString() },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      appErrorCodes(error).includes("SHARED_PROMOTION_REQUIRED"),
    );
    await expect(
      publishProduct(
        product.id,
        {
          version: product.version,
          locales: ["en", "zh"],
          promoteShared: true,
        },
        { id: actorId.toString() },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      appErrorCodes(error).includes("PRODUCT_SHORT_DESCRIPTION_REQUIRED"),
    );

    product = await ProductModel.findById(product._id).orFail();
    expect(product.publishedGlobal?.globalRevision).toBe(originalGlobalRevision);
    expect(product.publishedSnapshots.get("en")?.publicationRevision).toBe(
      originalEnglishRevision,
    );
    expect(product.publishedSnapshots.get("zh")?.publicationRevision).toBe(
      originalChineseRevision,
    );

    const repairedChinese = product.translations.get("zh");
    expect(repairedChinese).toBeDefined();
    if (repairedChinese !== undefined) {
      repairedChinese.shortDescription = "高效太阳能设备。";
    }
    await product.save();
    const promoted = await publishProduct(
      product.id,
      {
        version: product.version,
        locales: ["en", "zh"],
        promoteShared: true,
      },
      { id: actorId.toString() },
    );
    const promotedGlobalRevision =
      promoted.product.publishedGlobal?.globalRevision;
    expect(promotedGlobalRevision).not.toBe(originalGlobalRevision);
    expect(promoted.product.publishedSnapshots.en?.globalRevision).toBe(
      promotedGlobalRevision,
    );
    expect(promoted.product.publishedSnapshots.zh?.globalRevision).toBe(
      promotedGlobalRevision,
    );
    expect(promoted.product.localeStates).toMatchObject({
      en: "published",
      zh: "published",
    });

    product = await ProductModel.findById(product._id).orFail();
    product.slug = "renamed-after-publication";
    await product.save();
    await expect(
      publishProduct(
        product.id,
        {
          version: product.version,
          locales: ["en", "zh"],
          promoteShared: true,
        },
        { id: actorId.toString() },
      ),
    ).rejects.toSatisfy((error: unknown) =>
      appErrorCodes(error).includes("PRODUCT_SLUG_LOCKED"),
    );
  });

  it("reports category, media, template, and specification errors with stable editor paths", async () => {
    const { root, leaf, hero } = await createCatalog();
    let product = await createProduct(leaf._id, hero._id, "standard");
    root.status = "archived";
    await root.save();
    let report = await validationReport(product, ["en"]);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "categoryId",
          code: "PRODUCT_CATEGORY_ANCESTOR_INACTIVE",
        }),
      ]),
    );

    root.status = "active";
    await root.save();
    leaf.parentId = new Types.ObjectId();
    await leaf.save();
    report = await validationReport(product, ["en"]);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "categoryId",
          code: "PRODUCT_CATEGORY_ANCESTOR_MISSING",
        }),
      ]),
    );
    leaf.parentId = root._id;
    const chineseCategorySnapshot = leaf.publishedSnapshots.get("zh");
    expect(chineseCategorySnapshot).toBeDefined();
    leaf.publishedSnapshots.delete("zh");
    await leaf.save();
    report = await validationReport(product, ["zh"]);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "categoryId",
          code: "PRODUCT_CATEGORY_LOCALE_UNPUBLISHED",
        }),
      ]),
    );
    if (chineseCategorySnapshot !== undefined) {
      leaf.publishedSnapshots.set("zh", chineseCategorySnapshot);
    }
    await leaf.save();

    await MediaModel.collection.updateOne(
      { _id: hero._id },
      { $set: { kind: "document", mimeType: "application/pdf" } },
    );
    product = await ProductModel.findById(product._id).orFail();
    report = await validationReport(product, ["en"]);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "mediaUsages.0.mediaId",
          code: "PRODUCT_MEDIA_ROLE_TYPE_MISMATCH",
        }),
      ]),
    );

    await MediaModel.collection.updateOne(
      { _id: hero._id },
      { $set: { kind: "image", mimeType: "image/webp" } },
    );
    await ProductModel.collection.updateOne(
      { _id: product._id },
      { $set: { pageTemplate: "cms-import-path" } },
    );
    product = await ProductModel.findById(product._id).orFail();
    report = await validationReport(product, ["en"]);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "pageTemplate",
          code: "PRODUCT_TEMPLATE_UNKNOWN",
        }),
      ]),
    );

    await ProductModel.collection.updateOne(
      { _id: product._id },
      {
        $set: {
          pageTemplate: "standard",
          "specifications.1.order": 0,
        },
      },
    );
    product = await ProductModel.findById(product._id).orFail();
    report = await validationReport(product, ["en"]);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "specifications.1.order",
          code: "SPECIFICATION_GROUP_ORDER_DUPLICATE",
        }),
      ]),
    );

    const missingMediaId = new Types.ObjectId();
    await ProductModel.collection.updateOne(
      { _id: product._id },
      {
        $set: {
          "specifications.1.order": 1,
          "mediaUsages.0.mediaId": missingMediaId,
        },
      },
    );
    product = await ProductModel.findById(product._id).orFail();
    report = await validationReport(product, ["en"]);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "mediaUsages.0.mediaId",
          code: "PRODUCT_MEDIA_NOT_FOUND",
        }),
      ]),
    );

    const video = await MediaModel.create({
      kind: "video",
      storage: { provider: "local", key: `${randomUUID()}.mp4` },
      originalName: "overview.mp4",
      mimeType: "video/mp4",
      sizeBytes: 2_048,
      checksum: "e".repeat(64),
      durationSeconds: 15,
      defaultTranslations: new Map(),
      status: "ready",
      uploadedBy: actorId,
    });
    await ProductModel.collection.updateOne(
      { _id: product._id },
      {
        $set: {
          "mediaUsages.0.mediaId": video._id,
          "mediaUsages.0.role": "video",
        },
      },
    );
    product = await ProductModel.findById(product._id).orFail();
    report = await validationReport(product, ["en"]);
    expect(report.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "mediaUsages.0.mediaId",
          code: "PRODUCT_VIDEO_POSTER_REQUIRED",
        }),
      ]),
    );
  });

  it("validates both module and inverter shapes and hashes canonical order deterministically", async () => {
    const { leaf, hero } = await createCatalog();
    const module = await createProduct(leaf._id, hero._id);
    const inverter = await createProduct(leaf._id, undefined, "standard");
    const moduleReport = await validationReport(module, ["en"]);
    const inverterReport = await validationReport(inverter, ["en"]);
    expect(moduleReport.publishable).toBe(true);
    expect(inverterReport.publishable).toBe(true);

    const global = buildProductGlobalProjection(inverter);
    const english = buildProductLocaleProjection(inverter, "en");
    expect(global.errors).toEqual([]);
    expect(english.errors).toEqual([]);
    expect(hashCanonicalValue(global.data)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashCanonicalValue(english.data)).toMatch(/^[a-f0-9]{64}$/);

    const published = await publishProduct(
      inverter.id,
      { version: inverter.version, locales: ["en"], promoteShared: false },
      { id: actorId.toString() },
    );
    expect(published.product.status).toBe("published");
    expect(published.product.localeStates.en).toBe("published");
  });
});
