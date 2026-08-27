import { randomUUID } from "node:crypto";
import {
  apiErrorSchema,
  apiSuccessSchema,
  authenticatedSessionDtoSchema,
  categoryAdminDtoSchema,
  csrfDtoSchema,
  mediaUsagesDtoSchema,
  productAdminDtoSchema,
  productPublicationResultSchema,
  type CategoryAdminDto,
  type CreateCategoryRequest,
  type CreateProductRequest,
  type ProductAdminDto,
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
import { CategoryModel, type CategoryDocument } from "../src/models/Category.js";
import { MediaModel, type MediaDocument } from "../src/models/Media.js";
import { ProductModel } from "../src/models/Product.js";
import { UserModel } from "../src/models/User.js";
import { bootstrapAdministrator } from "../src/services/adminBootstrap.js";
import { createCategory } from "../src/services/categoryService.js";
import { deleteMedia } from "../src/services/mediaService.js";
import { createProduct } from "../src/services/productService.js";
import type {
  SaveObjectInput,
  StorageProvider,
  StoredObject,
} from "../src/storage/StorageProvider.js";
import { createTestConfig } from "./helpers/config.js";

const frontendOrigin = "http://localhost:3000";
const password = "Correct horse battery staple 42!";
const actorId = new Types.ObjectId();
let replicaSet: MongoMemoryReplSet;
let mongoUri: string;

class TestStorageProvider implements StorageProvider {
  readonly id = "local" as const;
  readonly deletedKeys: string[] = [];
  readonly savedInputs: SaveObjectInput[] = [];

  async save(input: SaveObjectInput): Promise<StoredObject> {
    this.savedInputs.push(input);
    return { provider: "local", key: randomUUID(), sizeBytes: 1 };
  }

  async delete(key: string): Promise<void> {
    this.deletedKeys.push(key);
  }

  async exists(): Promise<boolean> {
    return true;
  }

  getPublicUrl(key: string): string {
    return `http://localhost:5000/uploads/${key}`;
  }
}

type AuthenticatedAgent = {
  agent: ReturnType<typeof request.agent>;
  csrfToken: string;
};

async function authenticate(
  storageProvider: StorageProvider = new TestStorageProvider(),
): Promise<AuthenticatedAgent> {
  await bootstrapAdministrator({
    email: "admin@example.com",
    password,
    updateExisting: false,
  });
  const config = createTestConfig({ mongoUri });
  const app = createApp({
    config,
    sessionStore: createMongoSessionStore(config),
    storageProvider,
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
  return {
    agent,
    csrfToken: apiSuccessSchema(authenticatedSessionDtoSchema).parse(
      loginResponse.body,
    ).data.csrfToken,
  };
}

function categorySnapshot(name: string, globalRevision: string) {
  return {
    sourceVersion: 0,
    sourceHash: "b".repeat(64),
    globalRevision,
    publicationRevision: randomUUID(),
    publishedAt: new Date("2026-08-26T09:00:00.000Z"),
    data: { name, seo: { title: name } },
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
      ["en", { name: slug, seo: {} }],
      ["zh", { name: `${slug}中文`, seo: {} }],
    ]),
    publishedGlobal: {
      sourceVersion: 0,
      sourceHash: "a".repeat(64),
      globalRevision,
      publishedAt: new Date("2026-08-26T09:00:00.000Z"),
      data: { slug, parentId, sortOrder: 0 },
    },
    publishedSnapshots: new Map([
      ["en", categorySnapshot(slug, globalRevision)],
      ["zh", categorySnapshot(`${slug}中文`, globalRevision)],
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

function productInput(
  categoryId: Types.ObjectId,
  heroMediaId?: Types.ObjectId,
  slug = "630w-topcon",
): CreateProductRequest {
  return {
    slug,
    categoryId: categoryId.toString(),
    model: "MG-630N",
    series: "N-Type",
    translations: {
      en: {
        name: "630 W TOPCon module",
        shortDescription: "High-output bifacial solar module.",
        longDescriptionMarkdown: "Designed for utility-scale generation.",
        features: [],
        advantages: [],
        applications: [],
        seo: {},
      },
      zh: {
        name: "630瓦TOPCon组件",
        shortDescription: "高功率双面太阳能组件。",
        longDescriptionMarkdown: "专为大型太阳能项目设计。",
        features: [],
        advantages: [],
        applications: [],
        seo: {},
      },
    },
    specifications: [
      {
        key: "electrical",
        order: 0,
        translations: {
          en: { label: "Electrical characteristics" },
          zh: { label: "电气参数" },
        },
        items: [
          {
            key: "maximum-power",
            order: 0,
            value: "630",
            unit: "W",
            translations: {
              en: { label: "Maximum power" },
              zh: { label: "最大功率" },
            },
          },
        ],
      },
    ],
    mediaUsages:
      heroMediaId === undefined
        ? []
        : [
            {
              mediaId: heroMediaId.toString(),
              role: "hero",
              order: 0,
              translations: {
                en: { alt: "630 W TOPCon solar module" },
                zh: { alt: "630瓦TOPCon太阳能组件" },
              },
            },
          ],
    pageTemplate: "topcon-premium",
    displayOrder: 10,
    featured: true,
  };
}

function mutate(
  auth: AuthenticatedAgent,
  method: "delete" | "patch" | "post",
  path: string,
  body: object,
) {
  return auth.agent[method](path)
    .set("Origin", frontendOrigin)
    .set("X-CSRF-Token", auth.csrfToken)
    .send(body);
}

async function createProductRequest(
  auth: AuthenticatedAgent,
  input: CreateProductRequest,
): Promise<ProductAdminDto> {
  const response = await mutate(
    auth,
    "post",
    "/api/v1/admin/products",
    input,
  ).expect(201);
  return apiSuccessSchema(productAdminDtoSchema).parse(response.body).data;
}

async function createCategoryRequest(
  auth: AuthenticatedAgent,
  input: CreateCategoryRequest,
): Promise<CategoryAdminDto> {
  const response = await mutate(
    auth,
    "post",
    "/api/v1/admin/categories",
    input,
  ).expect(201);
  return apiSuccessSchema(categoryAdminDtoSchema).parse(response.body).data;
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  mongoUri = replicaSet.getUri("maglive_products_test");
  await connectDatabase(mongoUri);
  await Promise.all([
    UserModel.syncIndexes(),
    CategoryModel.syncIndexes(),
    MediaModel.syncIndexes(),
    ProductModel.syncIndexes(),
  ]);
}, 180_000);

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    CategoryModel.deleteMany({}),
    MediaModel.deleteMany({}),
    ProductModel.deleteMany({}),
    mongoose.connection.collection(SESSION_COLLECTION_NAME).deleteMany({}),
  ]);
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("product lifecycle APIs and reference integrity", () => {
  it("protects product routes and supports create, read, incomplete update, and optimistic concurrency", async () => {
    const { root, leaf, hero } = await createCatalog();
    const config = createTestConfig({ mongoUri });
    const app = createApp({
      config,
      sessionStore: createMongoSessionStore(config),
      storageProvider: new TestStorageProvider(),
    });
    await request(app)
      .get(`/api/v1/admin/products/${new Types.ObjectId().toString()}`)
      .expect(401);

    const auth = await authenticate();
    const csrfRejected = await auth.agent
      .post("/api/v1/admin/products")
      .set("Origin", frontendOrigin)
      .send(productInput(leaf._id, hero._id))
      .expect(403);
    expect(apiErrorSchema.parse(csrfRejected.body).error.code).toBe(
      "CSRF_INVALID",
    );

    let product = await createProductRequest(
      auth,
      productInput(leaf._id, hero._id),
    );
    expect(product.status).toBe("draft");
    expect(product.createdBy).toBe(product.updatedBy);
    const fetched = await auth.agent
      .get(`/api/v1/admin/products/${product.id}`)
      .expect(200);
    expect(
      apiSuccessSchema(productAdminDtoSchema).parse(fetched.body).data.slug,
    ).toBe(product.slug);

    const stale = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${product.id}`,
      { version: product.version + 1, model: "stale" },
    ).expect(409);
    expect(apiErrorSchema.parse(stale.body).error.code).toBe(
      "VERSION_CONFLICT",
    );

    const incomplete = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${product.id}`,
      {
        version: product.version,
        translations: {
          en: {
            name: "Incomplete saved draft",
            features: [],
            advantages: [],
            applications: [],
            seo: {},
          },
        },
      },
    ).expect(200);
    product = apiSuccessSchema(productAdminDtoSchema).parse(incomplete.body).data;
    expect(product.localeStates.en).toBe("incomplete");
    expect(product.publishedGlobal).toBeUndefined();

    const clearedOptionalField = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${product.id}`,
      { version: product.version, model: null },
    ).expect(200);
    product = apiSuccessSchema(productAdminDtoSchema).parse(
      clearedOptionalField.body,
    ).data;
    expect(product.model).toBeUndefined();

    const rootCategoryRejected = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${product.id}`,
      { version: product.version, categoryId: root.id },
    ).expect(422);
    expect(apiErrorSchema.parse(rootCategoryRejected.body).error.code).toBe(
      "PRODUCT_CATEGORY_NOT_LEAF",
    );

    const invalidMedia = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${product.id}`,
      {
        version: product.version,
        mediaUsages: [
          {
            mediaId: new Types.ObjectId().toString(),
            role: "hero",
            order: 0,
            translations: {},
          },
        ],
      },
    ).expect(422);
    expect(apiErrorSchema.parse(invalidMedia.body).error.code).toBe(
      "PRODUCT_MEDIA_INVALID",
    );

    const duplicateSlug = await mutate(
      auth,
      "post",
      "/api/v1/admin/products",
      productInput(leaf._id, hero._id),
    ).expect(201);
    expect(
      apiSuccessSchema(productAdminDtoSchema).parse(duplicateSlug.body).data.slug,
    ).toBe("630w-topcon-2");
  });

  it("runs publish, edit, duplicate, locale unpublish, archive, and delete-eligibility transitions", async () => {
    const { leaf, hero } = await createCatalog();
    const storage = new TestStorageProvider();
    const auth = await authenticate(storage);
    let product = await createProductRequest(
      auth,
      productInput(leaf._id, hero._id),
    );

    const english = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/publish`,
      { version: product.version, locales: ["en"], promoteShared: false },
    ).expect(200);
    product = apiSuccessSchema(productPublicationResultSchema).parse(english.body)
      .data.product;
    const liveEnglishName = product.publishedSnapshots.en?.data.name;

    const chinese = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/publish`,
      { version: product.version, locales: ["zh"], promoteShared: false },
    ).expect(200);
    product = apiSuccessSchema(productPublicationResultSchema).parse(chinese.body)
      .data.product;

    const immutableSlug = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${product.id}`,
      { version: product.version, slug: "renamed-live-product" },
    ).expect(409);
    expect(apiErrorSchema.parse(immutableSlug.body).error.code).toBe(
      "PUBLISHED_SLUG_IMMUTABLE",
    );

    const sharedEdit = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${product.id}`,
      { version: product.version, model: "MG-635N" },
    ).expect(200);
    product = apiSuccessSchema(productAdminDtoSchema).parse(sharedEdit.body).data;
    const previousGlobalRevision = product.publishedGlobal?.globalRevision;
    const implicitPromotion = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/publish`,
      { version: product.version, locales: ["en"], promoteShared: false },
    ).expect(422);
    expect(
      apiErrorSchema
        .parse(implicitPromotion.body)
        .error.details?.some(
          (detail) => detail.code === "SHARED_PROMOTION_REQUIRED",
        ),
    ).toBe(true);
    const promoted = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/publish`,
      {
        version: product.version,
        locales: ["en", "zh"],
        promoteShared: true,
      },
    ).expect(200);
    product = apiSuccessSchema(productPublicationResultSchema).parse(promoted.body)
      .data.product;
    expect(product.publishedGlobal?.globalRevision).not.toBe(
      previousGlobalRevision,
    );
    expect(product.publishedSnapshots.en?.globalRevision).toBe(
      product.publishedGlobal?.globalRevision,
    );
    expect(product.publishedSnapshots.zh?.globalRevision).toBe(
      product.publishedGlobal?.globalRevision,
    );

    const edited = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${product.id}`,
      {
        version: product.version,
        translations: {
          ...product.translations,
          en: {
            ...product.translations.en,
            name: "Working-only product name",
          },
        },
      },
    ).expect(200);
    product = apiSuccessSchema(productAdminDtoSchema).parse(edited.body).data;
    expect(product.translations.en?.name).toBe("Working-only product name");
    expect(product.publishedSnapshots.en?.data.name).toBe(liveEnglishName);
    expect(product.localeStates.en).toBe("changes-pending");

    const mediaCount = await MediaModel.countDocuments();
    const duplicated = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/duplicate`,
      { version: product.version },
    ).expect(201);
    const copy = apiSuccessSchema(productAdminDtoSchema).parse(duplicated.body)
      .data;
    expect(copy.slug).toBe("630w-topcon-copy");
    expect(copy.status).toBe("draft");
    expect(copy.publishedGlobal).toBeUndefined();
    expect(copy.publishedSnapshots).toEqual({});
    expect(copy.mediaUsages[0]?.mediaId).toBe(hero.id);
    expect(await MediaModel.countDocuments()).toBe(mediaCount);
    expect(storage.savedInputs).toEqual([]);

    const englishRetention = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/unpublish`,
      { version: product.version, locale: "en" },
    ).expect(409);
    expect(apiErrorSchema.parse(englishRetention.body).error.code).toBe(
      "DEFAULT_LOCALE_REQUIRED",
    );

    const withoutChinese = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/unpublish`,
      { version: product.version, locale: "zh" },
    ).expect(200);
    product = apiSuccessSchema(productAdminDtoSchema).parse(withoutChinese.body)
      .data;
    expect(product.publishedSnapshots.zh).toBeUndefined();

    const archived = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/archive`,
      { version: product.version },
    ).expect(200);
    product = apiSuccessSchema(productAdminDtoSchema).parse(archived.body).data;
    expect(product.status).toBe("archived");
    expect(product.publishedSnapshots.en).toBeDefined();
    await mutate(
      auth,
      "delete",
      `/api/v1/admin/products/${product.id}`,
      { version: product.version },
    ).expect(409);

    let neverPublished = copy;
    const deleted = await mutate(
      auth,
      "delete",
      `/api/v1/admin/products/${neverPublished.id}`,
      { version: neverPublished.version },
    ).expect(200);
    expect(deleted.body.data.deleted).toBe(true);
    expect(await ProductModel.findById(neverPublished.id)).toBeNull();

    const allUnpublished = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${product.id}/unpublish`,
      { version: product.version },
    ).expect(200);
    neverPublished = apiSuccessSchema(productAdminDtoSchema).parse(
      allUnpublished.body,
    ).data;
    expect(neverPublished.status).toBe("draft");
    expect(neverPublished.publishedGlobal).toBeUndefined();
    await mutate(
      auth,
      "delete",
      `/api/v1/admin/products/${neverPublished.id}`,
      { version: neverPublished.version },
    ).expect(409);
  });

  it("blocks category hierarchy/deletion and media deletion for working and retained live Product references", async () => {
    const { leaf, hero } = await createCatalog();
    const storage = new TestStorageProvider();
    const auth = await authenticate(storage);

    const unpublishedCategory = await createCategoryRequest(auth, {
      slug: "standalone",
      parentId: null,
      sortOrder: 0,
      translations: { en: { name: "Standalone", seo: {} } },
    });
    const draft = await createProductRequest(
      auth,
      productInput(
        new Types.ObjectId(unpublishedCategory.id),
        hero._id,
        "draft-category-product",
      ),
    );
    const deleteCategoryBlocked = await mutate(
      auth,
      "delete",
      `/api/v1/admin/categories/${unpublishedCategory.id}`,
      { version: unpublishedCategory.version },
    ).expect(409);
    expect(apiErrorSchema.parse(deleteCategoryBlocked.body).error.code).toBe(
      "CATEGORY_IN_USE",
    );
    expect(
      (await CategoryModel.findById(unpublishedCategory.id).orFail()).status,
    ).toBe("active");

    const childBlocked = await mutate(
      auth,
      "post",
      "/api/v1/admin/categories",
      {
        slug: "forbidden-child",
        parentId: unpublishedCategory.id,
        sortOrder: 0,
        translations: { en: { name: "Forbidden child", seo: {} } },
      },
    ).expect(409);
    expect(apiErrorSchema.parse(childBlocked.body).error.code).toBe(
      "CATEGORY_HAS_PRODUCTS",
    );

    const poster = await MediaModel.create({
      kind: "image",
      storage: { provider: "local", key: `${randomUUID()}.webp` },
      originalName: "poster.webp",
      mimeType: "image/webp",
      sizeBytes: 600,
      checksum: "9".repeat(64),
      defaultTranslations: new Map(),
      status: "ready",
      uploadedBy: actorId,
    });
    const video = await MediaModel.create({
      kind: "video",
      storage: { provider: "local", key: `${randomUUID()}.mp4` },
      originalName: "overview.mp4",
      mimeType: "video/mp4",
      sizeBytes: 1_200,
      checksum: "8".repeat(64),
      durationSeconds: 12,
      posterMediaId: poster._id,
      defaultTranslations: new Map(),
      status: "ready",
      uploadedBy: actorId,
    });
    const videoProductInput = productInput(
      new Types.ObjectId(unpublishedCategory.id),
      undefined,
      "video-product",
    );
    videoProductInput.mediaUsages = [
      {
        mediaId: video.id,
        role: "video",
        order: 0,
        translations: {},
      },
    ];
    await createProductRequest(auth, videoProductInput);
    const clearRequiredPoster = await mutate(
      auth,
      "patch",
      `/api/v1/admin/media/${video.id}`,
      { version: video.version, posterMediaId: null },
    ).expect(409);
    expect(apiErrorSchema.parse(clearRequiredPoster.body).error.code).toBe(
      "MEDIA_POSTER_REQUIRED_BY_PRODUCT",
    );

    let usages = await auth.agent
      .get(`/api/v1/admin/media/${hero.id}/usages`)
      .expect(200);
    expect(
      apiSuccessSchema(mediaUsagesDtoSchema).parse(usages.body).data.usages,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "product-working-media",
          ownerId: draft.id,
          path: "mediaUsages.0.mediaId",
        }),
      ]),
    );
    const deleteWorkingMedia = await mutate(
      auth,
      "delete",
      `/api/v1/admin/media/${hero.id}`,
      { version: hero.version },
    ).expect(409);
    expect(apiErrorSchema.parse(deleteWorkingMedia.body).error.code).toBe(
      "MEDIA_IN_USE",
    );

    let live = await createProductRequest(
      auth,
      productInput(leaf._id, hero._id, "live-media-product"),
    );
    const published = await mutate(
      auth,
      "post",
      `/api/v1/admin/products/${live.id}/publish`,
      { version: live.version, locales: ["en"], promoteShared: false },
    ).expect(200);
    live = apiSuccessSchema(productPublicationResultSchema).parse(published.body)
      .data.product;
    const removedWorkingMedia = await mutate(
      auth,
      "patch",
      `/api/v1/admin/products/${live.id}`,
      { version: live.version, mediaUsages: [] },
    ).expect(200);
    live = apiSuccessSchema(productAdminDtoSchema).parse(removedWorkingMedia.body)
      .data;

    usages = await auth.agent
      .get(`/api/v1/admin/media/${hero.id}/usages`)
      .expect(200);
    const reportedUsages = apiSuccessSchema(mediaUsagesDtoSchema).parse(
      usages.body,
    ).data.usages;
    expect(reportedUsages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "product-published-media",
          ownerId: live.id,
          path: "publishedGlobal.data.mediaUsages.0.mediaId",
        }),
        expect.objectContaining({
          kind: "product-published-media",
          ownerId: live.id,
          path: "publishedSnapshots.en.data.mediaUsages.0.mediaId",
        }),
      ]),
    );
    await mutate(
      auth,
      "delete",
      `/api/v1/admin/media/${hero.id}`,
      { version: (await MediaModel.findById(hero._id).orFail()).version },
    ).expect(409);

    const leafBeforeLocaleRemoval = await CategoryModel.findById(leaf._id).orFail();
    await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${leaf.id}/unpublish`,
      { version: leafBeforeLocaleRemoval.version, locale: "zh" },
    ).expect(200);
    const categoryUnpublishBlocked = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${leaf.id}/unpublish`,
      { version: (await CategoryModel.findById(leaf._id).orFail()).version, locale: "en" },
    ).expect(409);
    expect(apiErrorSchema.parse(categoryUnpublishBlocked.body).error.code).toBe(
      "PUBLISHED_PRODUCT_EXISTS",
    );
  });

  it("serializes concurrent product/category and product/media reference attempts", async () => {
    const root = await CategoryModel.create({
      slug: "concurrent-root",
      parentId: null,
      sortOrder: 0,
      translations: new Map([["en", { name: "Concurrent root", seo: {} }]]),
      publishedSnapshots: new Map(),
      status: "active",
      createdBy: actorId,
      updatedBy: actorId,
    });
    const media = await MediaModel.create({
      kind: "image",
      storage: { provider: "local", key: `${randomUUID()}.webp` },
      originalName: "concurrent.webp",
      mimeType: "image/webp",
      sizeBytes: 500,
      checksum: "d".repeat(64),
      defaultTranslations: new Map(),
      status: "ready",
      uploadedBy: actorId,
    });
    const actor = { id: actorId.toString() };
    const [productAttempt, childAttempt] = await Promise.allSettled([
      createProduct(
        productInput(root._id, media._id, "concurrent-category-product"),
        actor,
      ),
      createCategory(
        {
          slug: "concurrent-child",
          parentId: root.id,
          sortOrder: 0,
          translations: { en: { name: "Concurrent child", seo: {} } },
        },
        actor,
      ),
    ]);
    expect([productAttempt.status, childAttempt.status].sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const categoryProducts = await ProductModel.countDocuments({
      categoryId: root._id,
    });
    const categoryChildren = await CategoryModel.countDocuments({
      parentId: root._id,
    });
    expect(categoryProducts + categoryChildren).toBe(1);

    const secondRoot = await CategoryModel.create({
      slug: "media-race-root",
      parentId: null,
      sortOrder: 0,
      translations: new Map([["en", { name: "Media race", seo: {} }]]),
      publishedSnapshots: new Map(),
      status: "active",
      createdBy: actorId,
      updatedBy: actorId,
    });
    const raceMedia = await MediaModel.create({
      kind: "image",
      storage: { provider: "local", key: `${randomUUID()}.webp` },
      originalName: "race.webp",
      mimeType: "image/webp",
      sizeBytes: 500,
      checksum: "c".repeat(64),
      defaultTranslations: new Map(),
      status: "ready",
      uploadedBy: actorId,
    });
    const storage = new TestStorageProvider();
    const [referenceAttempt, deleteAttempt] = await Promise.allSettled([
      createProduct(
        productInput(secondRoot._id, raceMedia._id, "concurrent-media-product"),
        actor,
      ),
      deleteMedia(raceMedia.id, raceMedia.version, storage),
    ]);
    expect([referenceAttempt.status, deleteAttempt.status].sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    const raceProductExists =
      (await ProductModel.exists({ slug: "concurrent-media-product" })) !== null;
    const raceMediaExists = (await MediaModel.exists({ _id: raceMedia._id })) !== null;
    expect(raceProductExists).toBe(raceMediaExists);
  });
});
