import { randomUUID } from "node:crypto";
import {
  adminProductListDtoSchema,
  apiErrorSchema,
  apiSuccessSchema,
  authenticatedSessionDtoSchema,
  csrfDtoSchema,
  type AdminProductListDto,
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
import {
  SESSION_COLLECTION_NAME,
  createMongoSessionStore,
} from "../src/config/session.js";
import {
  buildProductGlobalProjection,
  buildProductLocaleProjection,
  hashCanonicalValue,
} from "../src/domain/productPublication.js";
import {
  ProductModel,
  type Product,
  type ProductDocument,
} from "../src/models/Product.js";
import { UserModel } from "../src/models/User.js";
import { bootstrapAdministrator } from "../src/services/adminBootstrap.js";
import { createTestConfig } from "./helpers/config.js";

const frontendOrigin = "http://localhost:3000";
const password = "Correct horse battery staple 42!";
const actorId = new Types.ObjectId();
const categoryA = new Types.ObjectId();
const categoryB = new Types.ObjectId();
let replicaSet: MongoMemoryReplSet;
let mongoUri: string;

type AuthenticatedAgent = ReturnType<typeof request.agent>;

async function authenticate(): Promise<AuthenticatedAgent> {
  await bootstrapAdministrator({
    email: "admin@example.com",
    password,
    updateExisting: false,
  });
  const config = createTestConfig({ mongoUri });
  const app = createApp({
    config,
    sessionStore: createMongoSessionStore(config),
  });
  const agent = request.agent(app);
  const csrfResponse = await agent.get("/api/v1/admin/auth/csrf").expect(200);
  const preAuthToken = apiSuccessSchema(csrfDtoSchema).parse(csrfResponse.body)
    .data.csrfToken;
  const loginResponse = await agent
    .post("/api/v1/admin/auth/login")
    .set("Origin", frontendOrigin)
    .set("X-CSRF-Token", preAuthToken)
    .send({ email: "admin@example.com", password })
    .expect(200);
  apiSuccessSchema(authenticatedSessionDtoSchema).parse(loginResponse.body);
  return agent;
}

function productSeed(
  slug: string,
  englishName: string,
  chineseName: string,
  categoryId: Types.ObjectId,
  displayOrder: number,
  featured: boolean,
  options: { incompleteEnglish?: boolean; literalSeries?: boolean } = {},
): Pick<
  Product,
  | "slug"
  | "categoryId"
  | "model"
  | "series"
  | "translations"
  | "specifications"
  | "mediaUsages"
  | "pageTemplate"
  | "displayOrder"
  | "featured"
  | "publishedSnapshots"
  | "status"
  | "createdBy"
  | "updatedBy"
> {
  return {
    slug,
    categoryId,
    model: `MODEL-${slug.toUpperCase()}`,
    ...(options.literalSeries === true ? { series: "Literal .* marker" } : {}),
    translations: new Map([
      [
        "en",
        {
          name: englishName,
          ...(options.incompleteEnglish === true
            ? {}
            : { shortDescription: `${englishName} short description.` }),
          features: [],
          advantages: [],
          applications: [],
          seo: {},
        },
      ],
      [
        "zh",
        {
          name: chineseName,
          shortDescription: `${chineseName}简介。`,
          features: [],
          advantages: [],
          applications: [],
          seo: {},
        },
      ],
    ]),
    specifications: [
      {
        key: "electrical",
        order: 0,
        translations: new Map([
          ["en", { label: "Electrical" }],
          ["zh", { label: "电气参数" }],
        ]),
        items: [
          {
            key: "power",
            order: 0,
            value: "10",
            unit: "kW",
            translations: new Map([
              ["en", { label: "Power" }],
              ["zh", { label: "功率" }],
            ]),
          },
        ],
      },
    ],
    mediaUsages: [],
    pageTemplate: "standard",
    displayOrder,
    featured,
    publishedSnapshots: new Map(),
    status: "draft",
    createdBy: actorId,
    updatedBy: actorId,
  };
}

async function publishSnapshots(
  product: ProductDocument,
  locales: readonly LocaleCode[],
): Promise<ProductDocument> {
  const global = buildProductGlobalProjection(product);
  if (global.data === undefined) throw new Error("Invalid shared test fixture.");
  const globalRevision = randomUUID();
  product.set("publishedGlobal", {
    sourceVersion: product.version,
    sourceHash: hashCanonicalValue(global.data),
    globalRevision,
    publishedAt: new Date("2026-08-26T09:00:00.000Z"),
    data: global.data,
  });
  for (const locale of locales) {
    const localized = buildProductLocaleProjection(product, locale);
    if (localized.data === undefined) {
      throw new Error(`Invalid ${locale} test fixture.`);
    }
    product.set(`publishedSnapshots.${locale}`, {
      sourceVersion: product.version,
      sourceHash: hashCanonicalValue(localized.data),
      globalRevision,
      publicationRevision: randomUUID(),
      publishedAt: new Date("2026-08-26T09:00:00.000Z"),
      data: localized.data,
    });
  }
  product.status = "published";
  product.firstPublishedAt = new Date("2026-08-26T09:00:00.000Z");
  await product.save();
  return product;
}

async function setUpdatedAt(
  product: ProductDocument,
  date: string,
): Promise<void> {
  await ProductModel.collection.updateOne(
    { _id: product._id },
    { $set: { updatedAt: new Date(date) } },
  );
}

async function seedProducts(): Promise<void> {
  const alpha = await ProductModel.create(
    productSeed(
      "alpha-module",
      "Alpine Module",
      "阿尔法组件",
      categoryA,
      10,
      true,
    ),
  );
  await publishSnapshots(alpha, ["en", "zh"]);

  const beta = await ProductModel.create(
    productSeed(
      "beta-inverter",
      "Beta Inverter",
      "贝塔逆变器",
      categoryA,
      10,
      false,
    ),
  );
  const literal = await ProductModel.create(
    productSeed(
      "literal-search",
      "Literal Search",
      "文字搜索",
      categoryB,
      20,
      false,
      { literalSeries: true },
    ),
  );
  const gamma = await ProductModel.create(
    productSeed(
      "gamma-draft",
      "Gamma Draft",
      "伽马草稿",
      categoryB,
      5,
      true,
      { incompleteEnglish: true },
    ),
  );
  const retired = await ProductModel.create(
    productSeed(
      "retired-product",
      "Retired Product",
      "已归档产品",
      categoryB,
      30,
      false,
    ),
  );
  await publishSnapshots(retired, ["en", "zh"]);
  retired.status = "archived";
  await retired.save();

  const pending = await ProductModel.create(
    productSeed(
      "zeta-pending",
      "Zeta Original",
      "泽塔产品",
      categoryB,
      10,
      false,
    ),
  );
  await publishSnapshots(pending, ["en"]);
  const pendingEnglish = pending.translations.get("en");
  if (pendingEnglish === undefined) throw new Error("Missing English fixture.");
  pendingEnglish.name = "Zeta Pending Edit";
  await pending.save();

  await Promise.all([
    setUpdatedAt(alpha, "2026-01-01T00:00:00.000Z"),
    setUpdatedAt(beta, "2026-01-02T00:00:00.000Z"),
    setUpdatedAt(literal, "2026-01-03T00:00:00.000Z"),
    setUpdatedAt(gamma, "2026-01-04T00:00:00.000Z"),
    setUpdatedAt(retired, "2026-01-05T00:00:00.000Z"),
    setUpdatedAt(pending, "2026-01-06T00:00:00.000Z"),
  ]);
}

async function list(
  agent: AuthenticatedAgent,
  query: Record<string, string | number> = {},
): Promise<AdminProductListDto> {
  const response = await agent
    .get("/api/v1/admin/products")
    .query(query)
    .expect(200);
  return apiSuccessSchema(adminProductListDtoSchema).parse(response.body).data;
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  mongoUri = replicaSet.getUri("maglive_product_query_test");
  await connectDatabase(mongoUri);
  await Promise.all([UserModel.syncIndexes(), ProductModel.syncIndexes()]);
}, 180_000);

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    ProductModel.deleteMany({}),
    mongoose.connection.collection(SESSION_COLLECTION_NAME).deleteMany({}),
  ]);
  await seedProducts();
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("bounded administrator product queries", () => {
  it("returns minimal default results, collection counts, and deterministic pages", async () => {
    const config = createTestConfig({ mongoUri });
    await request(createApp({ config }))
      .get("/api/v1/admin/products")
      .expect(401);
    const agent = await authenticate();
    const first = await list(agent);
    expect(first.pagination).toEqual({
      page: 1,
      limit: 20,
      total: 6,
      totalPages: 1,
    });
    expect(first.collectionCounts).toEqual({
      all: 6,
      draft: 3,
      published: 2,
      archived: 1,
      featured: 2,
    });
    expect(first.items.map((item) => item.slug)).toEqual([
      "zeta-pending",
      "retired-product",
      "gamma-draft",
      "literal-search",
      "beta-inverter",
      "alpha-module",
    ]);
    expect(
      first.items
        .filter((item) => item.canDeletePermanently)
        .map((item) => item.slug),
    ).toEqual(["gamma-draft", "literal-search", "beta-inverter"]);
    const serialized = JSON.stringify(first.items);
    expect(serialized).not.toContain("publishedSnapshots");
    expect(serialized).not.toContain("translations");
    expect(serialized).not.toContain("createdBy");
    expect(serialized).not.toContain("mediaUsages");
    expect(serialized).not.toContain("specifications");

    const secondPage = await list(agent, { page: 2, limit: 2 });
    expect(secondPage.items.map((item) => item.slug)).toEqual([
      "gamma-draft",
      "literal-search",
    ]);
    expect(secondPage.pagination.totalPages).toBe(3);
    const finalPage = await list(agent, { page: 3, limit: 2 });
    expect(finalPage.items).toHaveLength(2);
    const beyondFinal = await list(agent, { page: 4, limit: 2 });
    expect(beyondFinal.items).toEqual([]);
    expect(beyondFinal.pagination.total).toBe(6);
  });

  it("searches every enabled locale, escapes regex syntax, and combines filters", async () => {
    const agent = await authenticate();
    expect((await list(agent, { search: "Alpine" })).items[0]?.slug).toBe(
      "alpha-module",
    );
    expect((await list(agent, { search: "贝塔" })).items[0]?.slug).toBe(
      "beta-inverter",
    );
    expect(
      (await list(agent, { search: ".*" })).items.map((item) => item.slug),
    ).toEqual(["literal-search"]);
    expect(
      (await list(agent, { categoryId: categoryA.toString() })).items.map(
        (item) => item.slug,
      ),
    ).toEqual(["beta-inverter", "alpha-module"]);
    expect(
      (await list(agent, { status: "published" })).items.map(
        (item) => item.slug,
      ),
    ).toEqual(["zeta-pending", "alpha-module"]);
    expect(
      (
        await list(agent, {
          categoryId: categoryB.toString(),
          status: "draft",
          featured: "true",
        })
      ).items.map((item) => item.slug),
    ).toEqual(["gamma-draft"]);
    expect((await list(agent, { search: "absent" })).items).toEqual([]);
  });

  it("filters every derived locale state and returns bounded completeness summaries", async () => {
    const agent = await authenticate();
    expect(
      (
        await list(agent, {
          locale: "en",
          localeState: "published",
          status: "published",
        })
      ).items.map((item) => item.slug),
    ).toEqual(["alpha-module"]);
    expect(
      (
        await list(agent, {
          locale: "en",
          localeState: "changes-pending",
        })
      ).items.map((item) => item.slug),
    ).toEqual(["zeta-pending"]);
    const drafts = await list(agent, {
      locale: "en",
      localeState: "draft",
      sort: "name-asc",
    });
    expect(drafts.items.map((item) => item.slug)).toEqual([
      "beta-inverter",
      "literal-search",
    ]);
    expect(drafts.items[0]?.translationCompleteness.en).toMatchObject({
      hasTranslation: true,
      hasShortDescription: true,
      localizedSpecificationGroups: 1,
      requiredSpecificationGroups: 1,
      complete: true,
    });
    const incomplete = await list(agent, {
      locale: "en",
      localeState: "incomplete",
    });
    expect(incomplete.items.map((item) => item.slug)).toEqual(["gamma-draft"]);
    expect(incomplete.items[0]?.translationCompleteness.en).toMatchObject({
      hasTranslation: true,
      hasShortDescription: false,
      complete: false,
    });
    expect(
      (
        await list(agent, {
          locale: "zh",
          localeState: "published",
        })
      ).items.map((item) => item.slug),
    ).toEqual(["retired-product", "alpha-module"]);
  });

  it("allowlists every sort and uses ObjectId as the deterministic tie breaker", async () => {
    const agent = await authenticate();
    const expected: Record<string, string[]> = {
      "updated-desc": [
        "zeta-pending",
        "retired-product",
        "gamma-draft",
        "literal-search",
        "beta-inverter",
        "alpha-module",
      ],
      "updated-asc": [
        "alpha-module",
        "beta-inverter",
        "literal-search",
        "gamma-draft",
        "retired-product",
        "zeta-pending",
      ],
      "order-asc": [],
      "order-desc": [],
      "name-asc": [
        "alpha-module",
        "beta-inverter",
        "gamma-draft",
        "literal-search",
        "retired-product",
        "zeta-pending",
      ],
      "name-desc": [
        "zeta-pending",
        "retired-product",
        "literal-search",
        "gamma-draft",
        "beta-inverter",
        "alpha-module",
      ],
    };
    for (const sort of [
      "updated-desc",
      "updated-asc",
      "name-asc",
      "name-desc",
    ]) {
      expect(
        (await list(agent, { sort })).items.map((item) => item.slug),
      ).toEqual(expected[sort]);
    }

    for (const direction of ["order-asc", "order-desc"] as const) {
      const result = await list(agent, { sort: direction });
      const orderTenIds = result.items
        .filter((item) => item.displayOrder === 10)
        .map((item) => item.id);
      expect(orderTenIds).toEqual([...orderTenIds].sort());
      const orderValues = result.items.map((item) => item.displayOrder);
      expect(orderValues).toEqual(
        [...orderValues].sort((left, right) =>
          direction === "order-asc" ? left - right : right - left,
        ),
      );
    }
  });

  it("rejects excessive, malformed, operator-shaped, and unsupported query values", async () => {
    const agent = await authenticate();
    const invalidQueries: Record<string, string | number>[] = [
      { page: 0 },
      { limit: 101 },
      { categoryId: "invalid" },
      { search: "x".repeat(121) },
      { sort: "arbitrary" },
      { featured: "1" },
      { unknown: "value" },
      { "search[$regex]": ".*" },
    ];
    for (const query of invalidQueries) {
      const response = await agent
        .get("/api/v1/admin/products")
        .query(query)
        .expect(422);
      expect(apiErrorSchema.parse(response.body).error.code).toBe(
        "VALIDATION_FAILED",
      );
    }
  });

  it("uses the primary compound indexes for representative status/category/order paths", async () => {
    const categoryPlan = await ProductModel.find({
      status: "published",
      categoryId: categoryA,
    })
      .sort({ displayOrder: 1, _id: 1 })
      .explain("executionStats");
    const featuredPlan = await ProductModel.find({
      status: "published",
      featured: true,
    })
      .sort({ displayOrder: 1, _id: 1 })
      .explain("executionStats");
    expect(JSON.stringify(categoryPlan)).toContain(
      "status_1_categoryId_1_displayOrder_1",
    );
    expect(JSON.stringify(featuredPlan)).toContain(
      "status_1_featured_1_displayOrder_1",
    );
    expect(JSON.stringify(categoryPlan)).not.toContain('"stage":"COLLSCAN"');
    expect(JSON.stringify(featuredPlan)).not.toContain('"stage":"COLLSCAN"');
  });
});
