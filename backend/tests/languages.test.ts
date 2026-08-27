import {
  apiErrorSchema,
  apiSuccessSchema,
  authenticatedSessionDtoSchema,
  categoryAdminDtoSchema,
  csrfDtoSchema,
  languageDtoSchema,
  languageListDtoSchema,
} from "@maglive/contracts";
import session from "express-session";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import { LanguageModel } from "../src/models/Language.js";
import { CategoryModel } from "../src/models/Category.js";
import { UserModel } from "../src/models/User.js";
import { bootstrapAdministrator } from "../src/services/adminBootstrap.js";
import { createTestConfig } from "./helpers/config.js";

const frontendOrigin = "http://localhost:3000";
const password = "Correct horse battery staple 42!";
let replicaSet: MongoMemoryReplSet;
let mongoUri: string;

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  mongoUri = replicaSet.getUri("maglive_test");
  await connectDatabase(mongoUri);
  await Promise.all([
    UserModel.syncIndexes(),
    LanguageModel.syncIndexes(),
    CategoryModel.syncIndexes(),
  ]);
}, 180_000);

beforeEach(async () => {
  await Promise.all([
    UserModel.deleteMany({}),
    LanguageModel.deleteMany({}),
    CategoryModel.deleteMany({}),
  ]);
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

async function authenticatedAgent() {
  await bootstrapAdministrator({
    email: "admin@example.com",
    password,
    updateExisting: false,
  });
  const app = createApp({
    config: createTestConfig({ mongoUri }),
    sessionStore: new session.MemoryStore(),
  });
  const agent = request.agent(app);
  const csrfResponse = await agent.get("/api/v1/admin/auth/csrf").expect(200);
  const preAuthToken = apiSuccessSchema(csrfDtoSchema).parse(csrfResponse.body).data.csrfToken;
  const login = await agent
    .post("/api/v1/admin/auth/login")
    .set("Origin", frontendOrigin)
    .set("X-CSRF-Token", preAuthToken)
    .send({ email: "admin@example.com", password })
    .expect(200);
  const csrfToken = apiSuccessSchema(authenticatedSessionDtoSchema).parse(login.body).data.csrfToken;
  return { agent, csrfToken };
}

describe.sequential("managed languages", () => {
  it("publishes built-in languages without authentication", async () => {
    const app = createApp({
      config: createTestConfig({ mongoUri }),
      sessionStore: new session.MemoryStore(),
    });
    const response = await request(app).get("/api/v1/public/languages").expect(200);
    const result = apiSuccessSchema(languageListDtoSchema).parse(response.body).data;
    expect(result.languages.map(({ code }) => code)).toEqual(["en", "zh"]);
  });

  it("requires an authenticated, trusted, CSRF-protected request to add a language", async () => {
    const config = createTestConfig({ mongoUri });
    const app = createApp({ config, sessionStore: new session.MemoryStore() });
    const unauthenticated = await request(app)
      .post("/api/v1/admin/languages")
      .send({})
      .expect(401);
    expect(apiErrorSchema.parse(unauthenticated.body).error.code).toBe("AUTH_REQUIRED");

    const { agent, csrfToken } = await authenticatedAgent();
    await agent
      .post("/api/v1/admin/languages")
      .set("X-CSRF-Token", csrfToken)
      .send({
        code: "fr",
        languageTag: "fr-FR",
        acceptLanguageAliases: [],
        direction: "ltr",
        fallback: "en",
        label: "French",
        nativeLabel: "Français",
      })
      .expect(403);
  });

  it("adds a persistent language and rejects conflicting identities", async () => {
    const { agent, csrfToken } = await authenticatedAgent();
    const input = {
      code: "fr",
      languageTag: "fr-FR",
      acceptLanguageAliases: ["fr-CA"],
      direction: "ltr" as const,
      fallback: "en",
      label: "French",
      nativeLabel: "Français",
    };
    const createdResponse = await agent
      .post("/api/v1/admin/languages")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send(input)
      .expect(201);
    const created = apiSuccessSchema(languageDtoSchema).parse(createdResponse.body).data;
    expect(created).toMatchObject({ code: "fr", languageTag: "fr-FR", builtIn: false });

    const publicResponse = await agent.get("/api/v1/public/languages").expect(200);
    const languages = apiSuccessSchema(languageListDtoSchema).parse(publicResponse.body).data.languages;
    expect(languages.map(({ code }) => code)).toEqual(["en", "zh", "fr"]);

    const localizedCategoryResponse = await agent
      .post("/api/v1/admin/categories")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({
        slug: "modules-fr",
        translations: { fr: { name: "Modules", seo: {} } },
      })
      .expect(201);
    const localizedCategory = apiSuccessSchema(categoryAdminDtoSchema).parse(
      localizedCategoryResponse.body,
    ).data;
    expect(localizedCategory.translations.fr?.name).toBe("Modules");
    expect(localizedCategory.localeStates.fr).toBe("draft");

    const unsupportedCategory = await agent
      .post("/api/v1/admin/categories")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({
        slug: "modules-es",
        translations: { es: { name: "Módulos", seo: {} } },
      })
      .expect(422);
    expect(apiErrorSchema.parse(unsupportedCategory.body).error.code).toBe(
      "UNSUPPORTED_LOCALE",
    );

    const duplicate = await agent
      .post("/api/v1/admin/languages")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send(input)
      .expect(409);
    expect(apiErrorSchema.parse(duplicate.body).error.code).toBe("LANGUAGE_CODE_EXISTS");

    const unknownFallback = await agent
      .post("/api/v1/admin/languages")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", csrfToken)
      .send({ ...input, code: "de", languageTag: "de-DE", fallback: "es" })
      .expect(422);
    expect(apiErrorSchema.parse(unknownFallback.body).error.code).toBe("UNSUPPORTED_FALLBACK");
  });
});
