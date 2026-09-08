import {
  apiSuccessSchema,
  authenticatedSessionDtoSchema,
  csrfDtoSchema,
  mediaUsagesDtoSchema,
  publicSiteSettingsDtoSchema,
  siteSettingsAdminDtoSchema,
} from "@maglive/contracts";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import {
  SESSION_COLLECTION_NAME,
  createMongoSessionStore,
} from "../src/config/session.js";
import { MediaModel } from "../src/models/Media.js";
import { SiteSettingsModel } from "../src/models/SiteSettings.js";
import { UserModel } from "../src/models/User.js";
import { bootstrapAdministrator } from "../src/services/adminBootstrap.js";
import { LocalStorageProvider } from "../src/storage/LocalStorageProvider.js";
import { createTestConfig } from "./helpers/config.js";

const frontendOrigin = "http://localhost:3000";
const password = "Correct horse battery staple 42!";
let replicaSet: MongoMemoryReplSet;
let mongoUri: string;

async function authenticate(app: ReturnType<typeof createApp>) {
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

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  mongoUri = replicaSet.getUri("maglive_site_settings_test");
  await connectDatabase(mongoUri);
  await Promise.all([
    UserModel.syncIndexes(),
    MediaModel.syncIndexes(),
    SiteSettingsModel.syncIndexes(),
  ]);
}, 180_000);

beforeEach(async () => {
  await Promise.all([
    SiteSettingsModel.deleteMany({}),
    MediaModel.deleteMany({}),
    UserModel.deleteMany({}),
    mongoose.connection.collection(SESSION_COLLECTION_NAME).deleteMany({}),
  ]);
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("site icon settings", () => {
  it("selects a ready image, publishes it, and reports its media usage", async () => {
    await bootstrapAdministrator({
      email: "admin@example.com",
      password,
      updateExisting: false,
    });
    const config = createTestConfig({ mongoUri });
    const storageProvider = new LocalStorageProvider(
      config.uploadRoot,
      config.publicMediaBaseUrl,
    );
    const app = createApp({
      config,
      storageProvider,
      sessionStore: createMongoSessionStore(config),
    });
    const auth = await authenticate(app);
    const admin = await UserModel.findOne({ email: "admin@example.com" });
    const media = await MediaModel.create({
      kind: "image",
      storage: { provider: "local", key: "images/2026/09/08/icon.webp" },
      originalName: "icon.webp",
      mimeType: "image/webp",
      sizeBytes: 128,
      checksum: "a".repeat(64),
      width: 32,
      height: 32,
      variants: [],
      audioPolicy: "keep",
      defaultTranslations: new Map(),
      status: "ready",
      progress: 100,
      processingAttempts: 0,
      uploadedBy: admin!._id,
    });

    const updateResponse = await auth.agent
      .put("/api/v1/admin/site-settings")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({ iconMediaId: media._id.toString(), version: 0 })
      .expect(200);
    expect(
      apiSuccessSchema(siteSettingsAdminDtoSchema).parse(updateResponse.body)
        .data,
    ).toMatchObject({ iconMediaId: media._id.toString(), version: 1 });

    const publicResponse = await request(app)
      .get("/api/v1/public/site-settings")
      .expect(200);
    expect(
      apiSuccessSchema(publicSiteSettingsDtoSchema).parse(publicResponse.body)
        .data,
    ).toMatchObject({
      version: 1,
      icon: {
        id: media._id.toString(),
        url: "http://localhost:5000/uploads/images/2026/09/08/icon.webp",
        mimeType: "image/webp",
      },
    });

    const usagesResponse = await auth.agent
      .get(`/api/v1/admin/media/${media._id.toString()}/usages`)
      .expect(200);
    expect(
      apiSuccessSchema(mediaUsagesDtoSchema).parse(usagesResponse.body).data
        .usages,
    ).toEqual([
      expect.objectContaining({
        kind: "site-icon",
        ownerLabel: "Site appearance",
        placement: "Browser tab icon",
      }),
    ]);
  });

  it("rejects media that is not a ready image", async () => {
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
    const auth = await authenticate(app);
    const admin = await UserModel.findOne({ email: "admin@example.com" });
    const media = await MediaModel.create({
      kind: "video",
      storage: { provider: "local", key: "videos/2026/09/08/demo.mp4" },
      originalName: "demo.mp4",
      mimeType: "video/mp4",
      sizeBytes: 128,
      checksum: "b".repeat(64),
      variants: [],
      audioPolicy: "keep",
      defaultTranslations: new Map(),
      status: "ready",
      progress: 100,
      processingAttempts: 0,
      uploadedBy: admin!._id,
    });

    const response = await auth.agent
      .put("/api/v1/admin/site-settings")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .send({ iconMediaId: media._id.toString(), version: 0 })
      .expect(422);
    expect(response.body.error.code).toBe("SITE_ICON_NOT_READY");
  });
});
