import {
  apiErrorSchema,
  apiSuccessSchema,
  authenticatedSessionDtoSchema,
  categoryAdminDtoSchema,
  categoryListDtoSchema,
  csrfDtoSchema,
  publicCategoryDtoSchema,
  publicCategoryTreeDtoSchema,
  type CategoryAdminDto,
  type CreateCategoryRequest,
} from "@maglive/contracts";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
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
import { CategoryModel } from "../src/models/Category.js";
import { UserModel } from "../src/models/User.js";
import { bootstrapAdministrator } from "../src/services/adminBootstrap.js";
import { createTestConfig } from "./helpers/config.js";

const frontendOrigin = "http://localhost:3000";
const password = "Correct horse battery staple 42!";
let replicaSet: MongoMemoryReplSet;
let mongoUri: string;

type AuthenticatedAgent = {
  agent: ReturnType<typeof request.agent>;
  csrfToken: string;
};

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
  const csrfToken = apiSuccessSchema(authenticatedSessionDtoSchema).parse(
    loginResponse.body,
  ).data.csrfToken;
  return { agent, csrfToken };
}

function categoryInput(
  slug: string,
  name: string,
  parentId: string | null = null,
): CreateCategoryRequest {
  return {
    slug,
    parentId,
    sortOrder: 0,
    translations: {
      en: { name, seo: {} },
      zh: { name: `${name} 中文`, seo: {} },
    },
  };
}

async function createCategoryRequest(
  auth: AuthenticatedAgent,
  input: CreateCategoryRequest,
): Promise<CategoryAdminDto> {
  const response = await auth.agent
    .post("/api/v1/admin/categories")
    .set("Origin", frontendOrigin)
    .set("X-CSRF-Token", auth.csrfToken)
    .send(input)
    .expect(201);
  return apiSuccessSchema(categoryAdminDtoSchema).parse(response.body).data;
}

function mutate(
  auth: AuthenticatedAgent,
  method: "delete" | "patch" | "post",
  path: string,
  body: string | object | undefined,
) {
  return auth.agent[method](path)
    .set("Origin", frontendOrigin)
    .set("X-CSRF-Token", auth.csrfToken)
    .send(body);
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  mongoUri = replicaSet.getUri("maglive_category_test");
  await connectDatabase(mongoUri);
  await Promise.all([UserModel.syncIndexes(), CategoryModel.syncIndexes()]);
}, 180_000);

beforeEach(async () => {
  await Promise.all([
    CategoryModel.deleteMany({}),
    UserModel.deleteMany({}),
    mongoose.connection.collection(SESSION_COLLECTION_NAME).deleteMany({}),
  ]);
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("category administration and publication", () => {
  it("protects admin routes and validates slugs, hierarchy depth, uniqueness, and CSRF", async () => {
    const config = createTestConfig({ mongoUri });
    const app = createApp({
      config,
      sessionStore: createMongoSessionStore(config),
    });
    const unauthorized = await request(app)
      .get("/api/v1/admin/categories")
      .expect(401);
    expect(apiErrorSchema.parse(unauthorized.body).error.code).toBe(
      "AUTH_REQUIRED",
    );

    const auth = await authenticate();
    const csrfRejected = await auth.agent
      .post("/api/v1/admin/categories")
      .set("Origin", frontendOrigin)
      .send(categoryInput("modules", "Modules"))
      .expect(403);
    expect(apiErrorSchema.parse(csrfRejected.body).error.code).toBe(
      "CSRF_INVALID",
    );

    const root = await createCategoryRequest(
      auth,
      categoryInput("modules", "Modules"),
    );
    const child = await createCategoryRequest(
      auth,
      categoryInput("residential", "Residential", root.id),
    );
    expect(child.parentId).toBe(root.id);

    const selfParent = await mutate(
      auth,
      "patch",
      `/api/v1/admin/categories/${root.id}`,
      { version: root.version, parentId: root.id },
    );
    expect(selfParent.status).toBe(422);
    expect(apiErrorSchema.parse(selfParent.body).error.code).toBe(
      "CATEGORY_CYCLE",
    );

    const tooDeep = await mutate(
      auth,
      "post",
      "/api/v1/admin/categories",
      categoryInput("rooftop", "Rooftop", child.id),
    );
    expect(tooDeep.status).toBe(422);
    expect(apiErrorSchema.parse(tooDeep.body).error.code).toBe(
      "CATEGORY_DEPTH_EXCEEDED",
    );

    const duplicate = await mutate(
      auth,
      "post",
      "/api/v1/admin/categories",
      categoryInput("modules", "Duplicate"),
    );
    expect(duplicate.status).toBe(201);
    expect(
      apiSuccessSchema(categoryAdminDtoSchema).parse(duplicate.body).data.slug,
    ).toBe("modules-2");

    const invalid = await mutate(
      auth,
      "post",
      "/api/v1/admin/categories",
      categoryInput("Products", "Invalid"),
    );
    expect(invalid.status).toBe(422);
    expect(apiErrorSchema.parse(invalid.body).error.details?.[0]?.path).toBe(
      "body.slug",
    );
  });

  it("keeps working drafts private and publishes locales with parent and English-first rules", async () => {
    const auth = await authenticate();
    let root = await createCategoryRequest(
      auth,
      categoryInput("inverters", "Inverters"),
    );

    const emptyTree = await auth.agent
      .get("/api/v1/public/categories?locale=en")
      .expect(200);
    expect(
      apiSuccessSchema(publicCategoryTreeDtoSchema).parse(emptyTree.body).data
        .categories,
    ).toEqual([]);

    const chineseFirst = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${root.id}/publish`,
      { version: root.version, locales: ["zh"], promoteShared: false },
    );
    expect(chineseFirst.status).toBe(409);
    expect(apiErrorSchema.parse(chineseFirst.body).error.code).toBe(
      "DEFAULT_LOCALE_REQUIRED",
    );

    const published = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${root.id}/publish`,
      { version: root.version, locales: ["en"], promoteShared: false },
    ).expect(200);
    root = apiSuccessSchema(categoryAdminDtoSchema).parse(published.body).data;

    const publicBeforeEdit = await auth.agent
      .get("/api/v1/public/categories/inverters?locale=en")
      .expect(200);
    const liveEnglish = apiSuccessSchema(publicCategoryDtoSchema).parse(
      publicBeforeEdit.body,
    ).data;
    expect(liveEnglish.name).toBe("Inverters");
    expect(liveEnglish.availableLocales).toEqual(["en"]);
    await auth.agent
      .get("/api/v1/public/categories/inverters?locale=zh")
      .expect(404);

    const saved = await mutate(
      auth,
      "patch",
      `/api/v1/admin/categories/${root.id}`,
      {
        version: root.version,
        translations: {
          ...root.translations,
          en: { name: "Power Inverters", seo: {} },
        },
      },
    ).expect(200);
    root = apiSuccessSchema(categoryAdminDtoSchema).parse(saved.body).data;
    expect(root.localeStates.en).toBe("changes-pending");

    const publicAfterEdit = await auth.agent
      .get("/api/v1/public/categories/inverters?locale=en")
      .expect(200);
    expect(
      apiSuccessSchema(publicCategoryDtoSchema).parse(publicAfterEdit.body).data
        .name,
    ).toBe("Inverters");

    const republished = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${root.id}/publish`,
      { version: root.version, locales: ["en"], promoteShared: false },
    ).expect(200);
    root = apiSuccessSchema(categoryAdminDtoSchema).parse(republished.body).data;
    expect(root.localeStates.en).toBe("published");

    const child = await createCategoryRequest(
      auth,
      categoryInput("hybrid", "Hybrid", root.id),
    );
    const missingParentLocale = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${child.id}/publish`,
      { version: child.version, locales: ["en", "zh"], promoteShared: false },
    );
    expect(missingParentLocale.status).toBe(409);
    expect(apiErrorSchema.parse(missingParentLocale.body).error.code).toBe(
      "PARENT_LOCALE_NOT_PUBLISHED",
    );

    const rootChinese = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${root.id}/publish`,
      { version: root.version, locales: ["zh"], promoteShared: false },
    ).expect(200);
    root = apiSuccessSchema(categoryAdminDtoSchema).parse(rootChinese.body).data;
    expect(root.localeStates.zh).toBe("published");
    const englishRetention = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${root.id}/unpublish`,
      { version: root.version, locale: "en" },
    );
    expect(englishRetention.status).toBe(409);
    expect(apiErrorSchema.parse(englishRetention.body).error.code).toBe(
      "DEFAULT_LOCALE_REQUIRED",
    );
    const liveChinese = await auth.agent
      .get("/api/v1/public/categories/inverters?locale=zh")
      .expect(200);
    expect(
      apiSuccessSchema(publicCategoryDtoSchema).parse(liveChinese.body).data
        .availableLocales,
    ).toEqual(["en", "zh"]);
  });

  it("requires explicit shared promotion, rejects stale writes, and reorders a complete sibling set", async () => {
    const auth = await authenticate();
    let first = await createCategoryRequest(
      auth,
      categoryInput("modules", "Modules"),
    );
    let second = await createCategoryRequest(
      auth,
      categoryInput("inverters", "Inverters"),
    );
    const firstPublished = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${first.id}/publish`,
      { version: first.version, locales: ["en", "zh"], promoteShared: false },
    ).expect(200);
    first = apiSuccessSchema(categoryAdminDtoSchema).parse(firstPublished.body)
      .data;

    const changed = await mutate(
      auth,
      "patch",
      `/api/v1/admin/categories/${first.id}`,
      { version: first.version, sortOrder: 9 },
    ).expect(200);
    first = apiSuccessSchema(categoryAdminDtoSchema).parse(changed.body).data;

    const incompletePromotion = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${first.id}/publish`,
      { version: first.version, locales: ["en"], promoteShared: true },
    );
    expect(incompletePromotion.status).toBe(409);
    expect(apiErrorSchema.parse(incompletePromotion.body).error.code).toBe(
      "SHARED_PROMOTION_REQUIRED",
    );

    const promoted = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${first.id}/publish`,
      { version: first.version, locales: ["en", "zh"], promoteShared: true },
    ).expect(200);
    first = apiSuccessSchema(categoryAdminDtoSchema).parse(promoted.body).data;

    const stale = await mutate(
      auth,
      "patch",
      `/api/v1/admin/categories/${first.id}`,
      { version: first.version - 1, sortOrder: 3 },
    );
    expect(stale.status).toBe(409);
    expect(apiErrorSchema.parse(stale.body).error.code).toBe(
      "VERSION_CONFLICT",
    );

    const listResponse = await auth.agent
      .get("/api/v1/admin/categories")
      .expect(200);
    const list = apiSuccessSchema(categoryListDtoSchema).parse(listResponse.body)
      .data.categories;
    first = list.find((category) => category.id === first.id) ?? first;
    second = list.find((category) => category.id === second.id) ?? second;

    const reordered = await mutate(
      auth,
      "post",
      "/api/v1/admin/categories/reorder",
      {
        parentId: null,
        categories: [
          { id: second.id, version: second.version },
          { id: first.id, version: first.version },
        ],
      },
    ).expect(200);
    const ordered = apiSuccessSchema(categoryListDtoSchema).parse(reordered.body)
      .data.categories;
    expect(ordered.find((category) => category.id === second.id)?.sortOrder).toBe(
      0,
    );
    expect(ordered.find((category) => category.id === first.id)?.sortOrder).toBe(
      1,
    );
  });

  it("guards destructive operations and removes archived ancestors from public trees", async () => {
    const auth = await authenticate();
    let root = await createCategoryRequest(
      auth,
      categoryInput("modules", "Modules"),
    );
    let child = await createCategoryRequest(
      auth,
      categoryInput("utility", "Utility", root.id),
    );
    const rootPublished = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${root.id}/publish`,
      { version: root.version, locales: ["en"], promoteShared: false },
    ).expect(200);
    root = apiSuccessSchema(categoryAdminDtoSchema).parse(rootPublished.body).data;
    const childPublished = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${child.id}/publish`,
      { version: child.version, locales: ["en"], promoteShared: false },
    ).expect(200);
    child = apiSuccessSchema(categoryAdminDtoSchema).parse(childPublished.body)
      .data;

    const blockedUnpublish = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${root.id}/unpublish`,
      { version: root.version, locale: "en" },
    );
    expect(blockedUnpublish.status).toBe(409);
    expect(apiErrorSchema.parse(blockedUnpublish.body).error.code).toBe(
      "PUBLISHED_CHILD_EXISTS",
    );

    const archived = await mutate(
      auth,
      "post",
      `/api/v1/admin/categories/${root.id}/archive`,
      { version: root.version },
    ).expect(200);
    root = apiSuccessSchema(categoryAdminDtoSchema).parse(archived.body).data;
    expect(root.status).toBe("archived");
    const hidden = await auth.agent
      .get("/api/v1/public/categories?locale=en")
      .expect(200);
    expect(
      apiSuccessSchema(publicCategoryTreeDtoSchema).parse(hidden.body).data
        .categories,
    ).toEqual([]);

    const draftParent = await createCategoryRequest(
      auth,
      categoryInput("draft-parent", "Draft parent"),
    );
    await createCategoryRequest(
      auth,
      categoryInput("draft-child", "Draft child", draftParent.id),
    );
    const occupiedDelete = await mutate(
      auth,
      "delete",
      `/api/v1/admin/categories/${draftParent.id}`,
      { version: draftParent.version },
    );
    expect(occupiedDelete.status).toBe(409);
    expect(apiErrorSchema.parse(occupiedDelete.body).error.code).toBe(
      "CATEGORY_IN_USE",
    );
    const restored = await auth.agent
      .get(`/api/v1/admin/categories/${draftParent.id}`)
      .expect(200);
    expect(
      apiSuccessSchema(categoryAdminDtoSchema).parse(restored.body).data.status,
    ).toBe("active");

    const publishedDelete = await mutate(
      auth,
      "delete",
      `/api/v1/admin/categories/${child.id}`,
      { version: child.version },
    );
    expect(publishedDelete.status).toBe(409);
    expect(apiErrorSchema.parse(publishedDelete.body).error.code).toBe(
      "PUBLISHED_CATEGORY_DELETE_DENIED",
    );
  });
});
