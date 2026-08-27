import { randomUUID } from "node:crypto";
import {
  PRODUCT_LIMITS,
  productAdminDtoSchema,
  type ProductAdminDto,
} from "@maglive/contracts";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  type Product,
  ProductModel,
  type PublishedProductGlobal,
  type PublishedProductLocale,
  productLocaleSnapshotMatchesGlobal,
  toProductAdminDto,
} from "../src/models/Product.js";
import {
  connectDatabase,
  disconnectDatabase,
} from "../src/config/database.js";

let replicaSet: MongoMemoryReplSet;
const actorId = new Types.ObjectId();
const categoryId = new Types.ObjectId();
const heroMediaId = new Types.ObjectId();
const iconMediaId = new Types.ObjectId();

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

function solarModuleInput(): ProductSeed {
  return {
    slug: "630w-topcon",
    categoryId,
    model: "MG-630N",
    series: "N-Type",
    translations: new Map([
      [
        "en",
        {
          name: "630 W TOPCon module",
          shortDescription: "High-output bifacial solar module.",
          longDescriptionMarkdown: "Engineered for utility-scale arrays.",
          features: [
            {
              key: "bifacial-generation",
              title: "Bifacial generation",
              body: "Captures energy from both sides.",
              iconMediaId,
            },
          ],
          advantages: [
            { key: "low-degradation", title: "Low degradation" },
          ],
          applications: [
            { key: "utility-scale", title: "Utility-scale arrays" },
          ],
          warrantyInformation: "Thirty-year performance warranty.",
          seo: {
            title: "630 W TOPCon solar module",
            keywords: ["TOPCon", "bifacial"],
            openGraphMediaId: heroMediaId,
          },
        },
      ],
      [
        "zh",
        {
          name: "630瓦TOPCon组件",
          shortDescription: "高功率双面太阳能组件。",
          features: [
            { key: "bifacial-generation", title: "双面发电" },
          ],
          advantages: [
            { key: "low-degradation", title: "低衰减" },
          ],
          applications: [
            { key: "utility-scale", title: "大型地面电站" },
          ],
          seo: { title: "630瓦TOPCon太阳能组件" },
        },
      ],
    ]),
    specifications: [
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
          {
            key: "module-efficiency",
            order: 1,
            value: "23.3",
            unit: "%",
            translations: new Map([
              ["en", { label: "Module efficiency" }],
              ["zh", { label: "组件效率" }],
            ]),
          },
        ],
      },
    ],
    mediaUsages: [
      {
        mediaId: heroMediaId,
        role: "hero",
        order: 0,
        translations: new Map([
          ["en", { alt: "630 W TOPCon module" }],
          ["zh", { alt: "630瓦TOPCon组件" }],
        ]),
      },
    ],
    pageTemplate: "topcon-premium",
    displayOrder: 10,
    featured: true,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

function inverterInput(): ProductSeed {
  return {
    slug: "x1-hybrid-inverter",
    categoryId: new Types.ObjectId(),
    model: "X1-HYBRID",
    translations: new Map([
      [
        "en",
        {
          name: "X1 hybrid inverter",
          features: [],
          advantages: [],
          applications: [],
          seo: {},
        },
      ],
    ]),
    specifications: [
      {
        key: "dc-input",
        order: 0,
        translations: new Map([["en", { label: "DC input" }]]),
        items: [
          {
            key: "maximum-voltage",
            order: 0,
            value: "1000",
            unit: "V",
            translations: new Map([["en", { label: "Maximum voltage" }]]),
          },
        ],
      },
      {
        key: "ac-output",
        order: 1,
        translations: new Map([["en", { label: "AC output" }]]),
        items: [
          {
            key: "rated-power",
            order: 0,
            value: "12",
            unit: "kW",
            translations: new Map([["en", { label: "Rated power" }]]),
          },
        ],
      },
    ],
    mediaUsages: [],
    pageTemplate: "standard",
    displayOrder: 20,
    featured: false,
    createdBy: actorId,
    updatedBy: actorId,
  };
}

function publishedGlobal(globalRevision: string): PublishedProductGlobal {
  return {
    sourceVersion: 0,
    sourceHash: "a".repeat(64),
    globalRevision,
    publishedAt: new Date("2026-08-26T09:00:00.000Z"),
    data: {
      slug: "630w-topcon",
      categoryId,
      model: "MG-630N",
      series: "N-Type",
      specifications: [
        {
          key: "electrical",
          order: 0,
          items: [
            { key: "maximum-power", order: 0, value: "630", unit: "W" },
          ],
        },
      ],
      mediaUsages: [
        { mediaId: heroMediaId, role: "hero", order: 0 },
      ],
      pageTemplate: "topcon-premium",
      displayOrder: 10,
      featured: true,
    },
  };
}

function publishedEnglish(globalRevision: string): PublishedProductLocale {
  return {
    sourceVersion: 0,
    sourceHash: "b".repeat(64),
    globalRevision,
    publicationRevision: randomUUID(),
    publishedAt: new Date("2026-08-26T09:00:00.000Z"),
    data: {
      name: "630 W TOPCon module",
      shortDescription: "High-output bifacial solar module.",
      longDescriptionMarkdown: "Engineered for utility-scale arrays.",
      features: [
        {
          key: "bifacial-generation",
          title: "Bifacial generation",
          iconMediaId,
        },
      ],
      advantages: [
        { key: "low-degradation", title: "Low degradation" },
      ],
      applications: [
        { key: "utility-scale", title: "Utility-scale arrays" },
      ],
      warrantyInformation: "Thirty-year performance warranty.",
      seo: {
        title: "630 W TOPCon solar module",
        keywords: ["TOPCon", "bifacial"],
        openGraphMediaId: heroMediaId,
      },
      specifications: [
        {
          key: "electrical",
          label: "Electrical characteristics",
          items: [{ key: "maximum-power", label: "Maximum power" }],
        },
      ],
      mediaUsages: [
        {
          mediaId: heroMediaId,
          role: "hero",
          order: 0,
          alt: "630 W TOPCon module",
        },
      ],
    },
  };
}

async function validationErrorFor(document: InstanceType<typeof ProductModel>) {
  try {
    await document.validate();
  } catch (error) {
    expect(error).toBeInstanceOf(mongoose.Error.ValidationError);
    return error as mongoose.Error.ValidationError;
  }
  throw new Error("Expected Product validation to fail.");
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await connectDatabase(replicaSet.getUri("maglive_product_model_test"));
  await ProductModel.syncIndexes();
}, 180_000);

beforeEach(async () => {
  await ProductModel.deleteMany({});
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("Product model boundaries", () => {
  it("round-trips solar-module and inverter specifications through one model", async () => {
    const module = await new ProductModel(solarModuleInput()).save();
    const inverter = await new ProductModel(inverterInput()).save();
    const savedModule = await ProductModel.findById(module._id);
    const savedInverter = await ProductModel.findById(inverter._id);

    expect(savedModule?.specifications[0]?.key).toBe("electrical");
    expect(savedModule?.specifications[0]?.items[1]?.unit).toBe("%");
    expect(savedModule?.translations.get("zh")?.name).toBe(
      "630瓦TOPCon组件",
    );
    expect(savedInverter?.specifications.map((group) => group.key)).toEqual([
      "dc-input",
      "ac-output",
    ]);
    expect(savedInverter?.series).toBeUndefined();
    expect(savedInverter?.pageTemplate).toBe("standard");
  });

  it("round-trips split snapshots and exposes explicit revision coherence", async () => {
    const globalRevision = randomUUID();
    const product = await new ProductModel({
      ...solarModuleInput(),
      publishedGlobal: publishedGlobal(globalRevision),
      publishedSnapshots: new Map([
        ["en", publishedEnglish(globalRevision)],
      ]),
      status: "published",
      firstPublishedAt: new Date("2026-08-26T09:00:00.000Z"),
    }).save();
    const saved = await ProductModel.findById(product._id);
    if (saved === null) throw new Error("Expected saved Product.");

    expect(saved.publishedGlobal?.data).not.toHaveProperty("name");
    expect(saved.publishedSnapshots.get("en")?.data).not.toHaveProperty(
      "categoryId",
    );
    expect(productLocaleSnapshotMatchesGlobal(saved, "en")).toBe(true);
    expect(productLocaleSnapshotMatchesGlobal(saved, "zh")).toBe(false);

    const english = saved.publishedSnapshots.get("en");
    if (english === undefined) throw new Error("Expected English snapshot.");
    english.globalRevision = randomUUID();
    expect(productLocaleSnapshotMatchesGlobal(saved, "en")).toBe(false);
  });

  it("rejects malformed, duplicate, excessive, unsupported, and uncontrolled data", async () => {
    const duplicateGroups = new ProductModel({
      ...solarModuleInput(),
      specifications: [
        solarModuleInput().specifications[0],
        solarModuleInput().specifications[0],
      ],
    });
    expect((await validationErrorFor(duplicateGroups)).errors).toHaveProperty(
      "specifications",
    );

    const duplicateFeatures = new ProductModel({
      ...solarModuleInput(),
      translations: new Map([
        [
          "en",
          {
            name: "Duplicate features",
            features: [
              { key: "same-key", title: "One" },
              { key: "same-key", title: "Two" },
            ],
          },
        ],
      ]),
    });
    expect(
      (await validationErrorFor(duplicateFeatures)).errors,
    ).toHaveProperty("translations.en.features");

    const invalidKey = new ProductModel({
      ...solarModuleInput(),
      specifications: [
        { ...solarModuleInput().specifications[0], key: "Electrical Data" },
      ],
    });
    expect((await validationErrorFor(invalidKey)).errors).toHaveProperty(
      "specifications.0.key",
    );

    const unsupportedLocales = new ProductModel({
      ...solarModuleInput(),
      translations: new Map([
        [
          "DE",
          {
            name: "Nicht unterstützt",
            features: [],
            advantages: [],
            applications: [],
            seo: {},
          },
        ],
      ]),
      mediaUsages: [
        {
          mediaId: heroMediaId,
          role: "hero",
          order: 0,
          locale: "DE",
        },
      ],
    });
    const localeErrors = (await validationErrorFor(unsupportedLocales)).errors;
    expect(localeErrors).toHaveProperty("translations");
    expect(localeErrors).toHaveProperty("mediaUsages.0.locale");

    const invalidRole = new ProductModel({
      ...solarModuleInput(),
      mediaUsages: [
        { mediaId: heroMediaId, role: "component", order: 0 },
      ],
    });
    expect((await validationErrorFor(invalidRole)).errors).toHaveProperty(
      "mediaUsages.0.role",
    );

    const tooManyFeatures = new ProductModel({
      ...solarModuleInput(),
      translations: new Map([
        [
          "en",
          {
            name: "Too many features",
            features: Array.from(
              { length: PRODUCT_LIMITS.contentItemsPerList + 1 },
              (_, index) => ({ key: `feature-${index}`, title: "Feature" }),
            ),
          },
        ],
      ]),
    });
    expect((await validationErrorFor(tooManyFeatures)).errors).toHaveProperty(
      "translations.en.features",
    );

    const tooManyGroups = new ProductModel({
      ...solarModuleInput(),
      specifications: Array.from(
        { length: PRODUCT_LIMITS.specificationGroups + 1 },
        (_, index) => ({
          ...solarModuleInput().specifications[0],
          key: `group-${index}`,
        }),
      ),
    });
    expect((await validationErrorFor(tooManyGroups)).errors).toHaveProperty(
      "specifications",
    );

    const tooManyItems = new ProductModel({
      ...solarModuleInput(),
      specifications: [
        {
          ...solarModuleInput().specifications[0],
          items: Array.from(
            { length: PRODUCT_LIMITS.specificationItemsPerGroup + 1 },
            (_, index) => ({
              ...solarModuleInput().specifications[0]!.items[0],
              key: `item-${index}`,
            }),
          ),
        },
      ],
    });
    expect((await validationErrorFor(tooManyItems)).errors).toHaveProperty(
      "specifications.0.items",
    );

    const tooManyMedia = new ProductModel({
      ...solarModuleInput(),
      mediaUsages: Array.from(
        { length: PRODUCT_LIMITS.mediaUsages + 1 },
        (_, index) => ({
          mediaId: new Types.ObjectId(),
          role: "gallery",
          order: index,
        }),
      ),
    });
    expect((await validationErrorFor(tooManyMedia)).errors).toHaveProperty(
      "mediaUsages",
    );

    const tooManyKeywords = new ProductModel({
      ...solarModuleInput(),
      translations: new Map([
        [
          "en",
          {
            name: "Too many keywords",
            seo: {
              keywords: Array.from(
                { length: PRODUCT_LIMITS.seoKeywords + 1 },
                (_, index) => `keyword-${index}`,
              ),
            },
          },
        ],
      ]),
    });
    expect((await validationErrorFor(tooManyKeywords)).errors).toHaveProperty(
      "translations.en.seo.keywords",
    );

    const nestedUnsupportedLocale = new ProductModel({
      ...solarModuleInput(),
      specifications: [
        {
          ...solarModuleInput().specifications[0],
          translations: new Map([["DE", { label: "Elektrisch" }]]),
        },
      ],
    });
    expect(
      (await validationErrorFor(nestedUnsupportedLocale)).errors,
    ).toHaveProperty("specifications.0.translations");

    const excessiveText = new ProductModel({
      ...solarModuleInput(),
      model: "x".repeat(PRODUCT_LIMITS.model + 1),
    });
    expect((await validationErrorFor(excessiveText)).errors).toHaveProperty(
      "model",
    );

    expect(
      () =>
        new ProductModel({
          ...solarModuleInput(),
          categoryIds: [categoryId],
        }),
    ).toThrow(mongoose.Error.StrictModeError);
    expect(
      () =>
        new ProductModel({
          ...solarModuleInput(),
          templateData: { schemaVersion: 1, data: { component: "Hero" } },
        }),
    ).toThrow(mongoose.Error.StrictModeError);
  });

  it("enforces the complete eight-MiB BSON document cap", async () => {
    const specifications = Array.from(
      { length: PRODUCT_LIMITS.specificationGroups },
      (_, groupIndex) => ({
        key: `group-${groupIndex}`,
        order: groupIndex,
        translations: new Map([["en", { label: "Large group" }]]),
        items: Array.from(
          { length: PRODUCT_LIMITS.specificationItemsPerGroup },
          (_, itemIndex) => ({
            key: `item-${itemIndex}`,
            order: itemIndex,
            value: "value",
            translations: new Map([
              [
                "en",
                {
                  label: "Large item",
                  note: "a".repeat(PRODUCT_LIMITS.specificationNote),
                },
              ],
              [
                "zh",
                {
                  label: "大项目",
                  note: "界".repeat(PRODUCT_LIMITS.specificationNote),
                },
              ],
            ]),
          }),
        ),
      }),
    );
    const oversized = new ProductModel({
      ...solarModuleInput(),
      specifications,
    });
    const error = await validationErrorFor(oversized);

    expect(error.errors).toHaveProperty("$document");
    expect(error.errors.$document?.kind).toBe("productDocumentSize");
  }, 30_000);

  it("serializes maps, ObjectIds, dates, and snapshots into a private-safe DTO", async () => {
    const globalRevision = randomUUID();
    const product = await new ProductModel({
      ...solarModuleInput(),
      publishedGlobal: publishedGlobal(globalRevision),
      publishedSnapshots: new Map([
        ["en", publishedEnglish(globalRevision)],
      ]),
      status: "published",
    }).save();
    const dto: ProductAdminDto = toProductAdminDto(product);
    const parsed = productAdminDtoSchema.parse(dto);

    expect(parsed.id).toBe(product.id);
    expect(parsed.categoryId).toBe(categoryId.toString());
    expect(parsed.translations).not.toBeInstanceOf(Map);
    expect(parsed.publishedSnapshots).not.toBeInstanceOf(Map);
    expect(parsed.publishedGlobal?.publishedAt).toBe(
      "2026-08-26T09:00:00.000Z",
    );
    expect(JSON.stringify(parsed)).not.toContain("ObjectId");
    expect(parsed).not.toHaveProperty("storage");
    expect(parsed).not.toHaveProperty("binary");
    expect(parsed).not.toHaveProperty("templateData");
  });

  it("creates every locked Product index", async () => {
    const indexes = await ProductModel.collection.indexes();
    const keys = indexes.map((index) => index.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        { slug: 1 },
        { status: 1, categoryId: 1, displayOrder: 1 },
        { status: 1, featured: 1, displayOrder: 1 },
        { categoryId: 1 },
        { updatedAt: -1 },
      ]),
    );
    expect(indexes.find((index) => index.key.slug === 1)?.unique).toBe(true);
  });
});
