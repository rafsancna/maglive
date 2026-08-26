import { readdir } from "node:fs/promises";
import {
  apiErrorSchema,
  apiSuccessSchema,
  adminMediaDtoSchema,
  authenticatedSessionDtoSchema,
  categoryAdminDtoSchema,
  csrfDtoSchema,
  mediaListDtoSchema,
  mediaUsagesDtoSchema,
  type AdminMediaDto,
} from "@maglive/contracts";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
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
import { MediaModel } from "../src/models/Media.js";
import { UserModel } from "../src/models/User.js";
import { bootstrapAdministrator } from "../src/services/adminBootstrap.js";
import { LocalStorageProvider } from "../src/storage/LocalStorageProvider.js";
import type {
  SaveObjectInput,
  StorageProvider,
  StoredObject,
} from "../src/storage/StorageProvider.js";
import { createTestConfig } from "./helpers/config.js";
import {
  createTemporaryUploadRoot,
  removeTemporaryUploadRoot,
} from "./helpers/temporaryUploadRoot.js";

const frontendOrigin = "http://localhost:3000";
const password = "Correct horse battery staple 42!";
let replicaSet: MongoMemoryReplSet;
let mongoUri: string;
let uploadRoot: string;

type AuthenticatedAgent = {
  agent: ReturnType<typeof request.agent>;
  csrfToken: string;
};

function png(width = 1, height = 1): Buffer {
  const value = Buffer.alloc(33);
  Buffer.from("89504e470d0a1a0a", "hex").copy(value, 0);
  value.writeUInt32BE(13, 8);
  value.write("IHDR", 12, "ascii");
  value.writeUInt32BE(width, 16);
  value.writeUInt32BE(height, 20);
  value[24] = 8;
  value[25] = 6;
  return value;
}

function jpeg(): Buffer {
  return Buffer.from(
    "ffd8ffc00011080001000103011100021100031100ffd9",
    "hex",
  );
}

function webp(): Buffer {
  const value = Buffer.alloc(30);
  value.write("RIFF", 0, "ascii");
  value.writeUInt32LE(22, 4);
  value.write("WEBP", 8, "ascii");
  value.write("VP8X", 12, "ascii");
  value.writeUInt32LE(10, 16);
  return value;
}

function mp4(): Buffer {
  const value = Buffer.alloc(20);
  value.writeUInt32BE(20, 0);
  value.write("ftyp", 4, "ascii");
  value.write("isom", 8, "ascii");
  return value;
}

function webm(): Buffer {
  return Buffer.from("1a45dfa39f42868101", "hex");
}

function pdf(): Buffer {
  return Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n");
}

async function authenticate(
  overrides: Parameters<typeof createTestConfig>[0] = {},
  storageProvider?: StorageProvider,
): Promise<AuthenticatedAgent> {
  await bootstrapAdministrator({
    email: "admin@example.com",
    password,
    updateExisting: false,
  });
  const config = createTestConfig({
    mongoUri,
    uploadRoot,
    ...overrides,
  });
  const app = createApp({
    config,
    sessionStore: createMongoSessionStore(config),
    ...(storageProvider === undefined ? {} : { storageProvider }),
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

async function upload(
  auth: AuthenticatedAgent,
  value: Buffer,
  filename: string,
  contentType: string,
): Promise<AdminMediaDto> {
  const response = await auth.agent
    .post("/api/v1/admin/media")
    .set("Origin", frontendOrigin)
    .set("X-CSRF-Token", auth.csrfToken)
    .attach("file", value, { filename, contentType })
    .expect(201);
  return apiSuccessSchema(adminMediaDtoSchema).parse(response.body).data;
}

function mutation(
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

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  mongoUri = replicaSet.getUri("maglive_media_test");
  await connectDatabase(mongoUri);
  await Promise.all([
    UserModel.syncIndexes(),
    CategoryModel.syncIndexes(),
    MediaModel.syncIndexes(),
  ]);
}, 180_000);

beforeEach(async () => {
  uploadRoot = await createTemporaryUploadRoot();
  await Promise.all([
    CategoryModel.deleteMany({}),
    MediaModel.deleteMany({}),
    UserModel.deleteMany({}),
    mongoose.connection.collection(SESSION_COLLECTION_NAME).deleteMany({}),
  ]);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await removeTemporaryUploadRoot(uploadRoot);
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("secure media pipeline", () => {
  it("accepts each approved signature, derives metadata, and stores no binary data in MongoDB", async () => {
    const auth = await authenticate();
    const candidates = [
      { value: jpeg(), name: "photo.jpeg", mime: "image/jpeg", kind: "image" },
      { value: png(3, 2), name: "diagram.png", mime: "image/png", kind: "image" },
      { value: webp(), name: "render.webp", mime: "image/webp", kind: "image" },
      { value: mp4(), name: "demo.mp4", mime: "video/mp4", kind: "video" },
      { value: webm(), name: "demo.webm", mime: "video/webm", kind: "video" },
      {
        value: pdf(),
        name: "datasheet.pdf",
        mime: "application/pdf",
        kind: "document",
      },
    ] as const;

    for (const candidate of candidates) {
      const media = await upload(
        auth,
        candidate.value,
        candidate.name,
        candidate.mime,
      );
      expect(media.kind).toBe(candidate.kind);
      expect(media.mimeType).toBe(candidate.mime);
      expect(media.status).toBe("ready");
      expect(media.url).toMatch(/^http:\/\/localhost:5000\/uploads\//);
    }
    const pngRecord = await MediaModel.findOne({ originalName: "diagram.png" });
    expect(pngRecord).toMatchObject({ width: 3, height: 2 });
    const rawDocuments = await mongoose.connection
      .collection("media")
      .find({})
      .toArray();
    expect(JSON.stringify(rawDocuments)).not.toContain("89504e47");
    expect(
      rawDocuments.every(
        (record) =>
          !("data" in record) &&
          !("buffer" in record) &&
          typeof record.storage?.key === "string",
      ),
    ).toBe(true);
  });

  it("rejects forged, unsupported, oversized, multiple, truncated, unauthorized, and CSRF-invalid uploads", async () => {
    const auth = await authenticate({ maxImageBytes: 40 });
    const invalidCases = [
      {
        value: Buffer.from("MZ executable"),
        name: "renamed.jpg",
        mime: "image/jpeg",
        status: 422,
      },
      {
        value: Buffer.from("%PDF-1.7 without trailer"),
        name: "broken.pdf",
        mime: "application/pdf",
        status: 422,
      },
      {
        value: Buffer.from("<svg></svg>"),
        name: "vector.svg",
        mime: "image/svg+xml",
        status: 415,
      },
      {
        value: Buffer.concat([png(), Buffer.alloc(20)]),
        name: "large.png",
        mime: "image/png",
        status: 413,
      },
    ];
    for (const candidate of invalidCases) {
      const response = await auth.agent
        .post("/api/v1/admin/media")
        .set("Origin", frontendOrigin)
        .set("X-CSRF-Token", auth.csrfToken)
        .attach("file", candidate.value, {
          filename: candidate.name,
          contentType: candidate.mime,
        })
        .expect(candidate.status);
      expect(apiErrorSchema.parse(response.body).error.code).toMatch(
        /INVALID_MEDIA_FILE|UNSUPPORTED_MEDIA_TYPE|MEDIA_TOO_LARGE/,
      );
    }

    const multiple = await auth.agent
      .post("/api/v1/admin/media")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .attach("file", png(), { filename: "one.png", contentType: "image/png" })
      .attach("file", png(), { filename: "two.png", contentType: "image/png" })
      .expect(422);
    expect(apiErrorSchema.parse(multiple.body).error.code).toBe(
      "ONE_FILE_REQUIRED",
    );

    const truncated = await auth.agent
      .post("/api/v1/admin/media")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .set("Content-Type", "multipart/form-data; boundary=cut")
      .send("--cut\r\nContent-Disposition: form-data; name=file")
      .expect(400);
    expect(apiErrorSchema.parse(truncated.body).error.code).toBe(
      "INVALID_MULTIPART",
    );

    const config = createTestConfig({ mongoUri, uploadRoot });
    const unauthenticatedApp = createApp({
      config,
      sessionStore: createMongoSessionStore(config),
    });
    await request(unauthenticatedApp)
      .post("/api/v1/admin/media")
      .attach("file", png(), { filename: "image.png", contentType: "image/png" })
      .expect(401);
    await auth.agent
      .post("/api/v1/admin/media")
      .set("Origin", frontendOrigin)
      .attach("file", png(), { filename: "image.png", contentType: "image/png" })
      .expect(403);

    expect(await MediaModel.countDocuments()).toBe(0);
    const temporary = await readdir(
      new LocalStorageProvider(
        uploadRoot,
        "http://localhost:5000/uploads",
      ).root,
    );
    expect(temporary.filter((entry) => entry !== ".temporary")).toEqual([]);
  });

  it("cleans promoted storage when database persistence fails", async () => {
    const auth = await authenticate();
    vi.spyOn(MediaModel.prototype, "save").mockRejectedValueOnce(
      new Error("database write failed"),
    );
    await auth.agent
      .post("/api/v1/admin/media")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", auth.csrfToken)
      .attach("file", png(), {
        filename: "../../unsafe-name.png",
        contentType: "image/png",
      })
      .expect(500);
    expect(await MediaModel.countDocuments()).toBe(0);
    const provider = new LocalStorageProvider(
      uploadRoot,
      "http://localhost:5000/uploads",
    );
    const imageRoot = `${provider.root}\\images`;
    const remaining = await readdir(imageRoot, {
      recursive: true,
      withFileTypes: true,
    });
    expect(remaining.some((entry) => entry.isFile())).toBe(false);
  });
});

describe.sequential("media metadata, usage, and deletion", () => {
  it("filters media, edits translations, and validates poster references", async () => {
    const auth = await authenticate();
    const image = await upload(auth, png(), "poster.png", "image/png");
    let video = await upload(auth, mp4(), "launch.mp4", "video/mp4");
    const document = await upload(
      auth,
      pdf(),
      "datasheet.pdf",
      "application/pdf",
    );

    const filtered = await auth.agent
      .get("/api/v1/admin/media?kind=image&search=poster&page=1&limit=10")
      .expect(200);
    const list = apiSuccessSchema(mediaListDtoSchema).parse(filtered.body).data;
    expect(list.items.map((item) => item.id)).toEqual([image.id]);
    expect(list.pagination).toMatchObject({ total: 1, page: 1, limit: 10 });

    const updated = await mutation(
      auth,
      "patch",
      `/api/v1/admin/media/${video.id}`,
      {
        version: video.version,
        posterMediaId: image.id,
        defaultTranslations: {
          en: { title: "Launch video", caption: "Product overview" },
          zh: { title: "产品视频" },
        },
      },
    ).expect(200);
    video = apiSuccessSchema(adminMediaDtoSchema).parse(updated.body).data;
    expect(video.posterMediaId).toBe(image.id);
    expect(video.defaultTranslations.zh?.title).toBe("产品视频");

    const usages = await auth.agent
      .get(`/api/v1/admin/media/${image.id}/usages`)
      .expect(200);
    expect(
      apiSuccessSchema(mediaUsagesDtoSchema).parse(usages.body).data.usages,
    ).toEqual([
      expect.objectContaining({
        kind: "media-poster",
        ownerId: video.id,
      }),
    ]);

    const wrongOwner = await mutation(
      auth,
      "patch",
      `/api/v1/admin/media/${image.id}`,
      { version: image.version, posterMediaId: video.id },
    );
    expect(wrongOwner.status).toBe(422);
    const selfPoster = await mutation(
      auth,
      "patch",
      `/api/v1/admin/media/${video.id}`,
      { version: video.version, posterMediaId: video.id },
    );
    expect(selfPoster.status).toBe(422);
    const wrongPosterKind = await mutation(
      auth,
      "patch",
      `/api/v1/admin/media/${video.id}`,
      { version: video.version, posterMediaId: document.id },
    );
    expect(wrongPosterKind.status).toBe(409);
    expect(apiErrorSchema.parse(wrongPosterKind.body).error.code).toBe(
      "POSTER_NOT_READY",
    );
    const referencedPosterDelete = await mutation(
      auth,
      "delete",
      `/api/v1/admin/media/${image.id}`,
      { version: image.version },
    );
    expect(referencedPosterDelete.status).toBe(409);
    expect(apiErrorSchema.parse(referencedPosterDelete.body).error.code).toBe(
      "MEDIA_IN_USE",
    );
  });

  it("retains live category usages after working removal and deletes only after unpublish", async () => {
    const auth = await authenticate();
    const image = await upload(auth, png(), "category.png", "image/png");
    const created = await mutation(
      auth,
      "post",
      "/api/v1/admin/categories",
      {
        slug: "modules",
        translations: {
          en: {
            name: "Modules",
            seo: { openGraphMediaId: image.id },
          },
        },
        image: {
          mediaId: image.id,
          translations: { en: { alt: "Solar module array" } },
        },
      },
    ).expect(201);
    let category = apiSuccessSchema(categoryAdminDtoSchema).parse(created.body)
      .data;
    const published = await mutation(
      auth,
      "post",
      `/api/v1/admin/categories/${category.id}/publish`,
      { version: category.version, locales: ["en"], promoteShared: false },
    ).expect(200);
    category = apiSuccessSchema(categoryAdminDtoSchema).parse(published.body)
      .data;
    const workingRemoved = await mutation(
      auth,
      "patch",
      `/api/v1/admin/categories/${category.id}`,
      {
        version: category.version,
        translations: { en: { name: "Modules", seo: {} } },
        image: null,
      },
    ).expect(200);
    category = apiSuccessSchema(categoryAdminDtoSchema).parse(workingRemoved.body)
      .data;

    const usageResponse = await auth.agent
      .get(`/api/v1/admin/media/${image.id}/usages`)
      .expect(200);
    const usages = apiSuccessSchema(mediaUsagesDtoSchema).parse(
      usageResponse.body,
    ).data.usages;
    expect(usages.map((usage) => usage.kind)).toEqual([
      "category-published-image",
      "category-published-seo",
    ]);
    const blocked = await mutation(
      auth,
      "delete",
      `/api/v1/admin/media/${image.id}`,
      { version: image.version },
    );
    expect(blocked.status).toBe(409);
    expect(apiErrorSchema.parse(blocked.body).error.code).toBe("MEDIA_IN_USE");

    const refreshedMedia = await auth.agent
      .get(`/api/v1/admin/media/${image.id}`)
      .expect(200);
    const currentMedia = apiSuccessSchema(adminMediaDtoSchema).parse(
      refreshedMedia.body,
    ).data;
    const unpublished = await mutation(
      auth,
      "post",
      `/api/v1/admin/categories/${category.id}/unpublish`,
      { version: category.version, locale: "en" },
    ).expect(200);
    category = apiSuccessSchema(categoryAdminDtoSchema).parse(unpublished.body)
      .data;
    expect(category.publishedSnapshots).toEqual({});
    await mutation(
      auth,
      "delete",
      `/api/v1/admin/media/${image.id}`,
      { version: currentMedia.version },
    ).expect(200);
    expect(await MediaModel.findById(image.id)).toBeNull();
  });

  it("leaves cleanup failures retriable and completes a later retry", async () => {
    class FailingDeleteProvider implements StorageProvider {
      readonly id = "local" as const;
      failDelete = true;
      async save(_input: SaveObjectInput): Promise<StoredObject> {
        throw new Error("unused");
      }
      async delete(_key: string): Promise<void> {
        if (this.failDelete) throw new Error("storage unavailable");
      }
      async exists(_key: string): Promise<boolean> {
        return true;
      }
      getPublicUrl(key: string): string {
        return `https://media.example/${key}`;
      }
    }
    const provider = new FailingDeleteProvider();
    const auth = await authenticate({}, provider);
    const user = await UserModel.findOne();
    if (user === null) throw new Error("Expected test administrator.");
    const media = await MediaModel.create({
      kind: "image",
      storage: { provider: "local", key: "images/retry.png" },
      originalName: "retry.png",
      mimeType: "image/png",
      sizeBytes: 33,
      checksum: "a".repeat(64),
      width: 1,
      height: 1,
      defaultTranslations: new Map(),
      status: "ready",
      uploadedBy: user._id,
    });

    const failed = await mutation(
      auth,
      "delete",
      `/api/v1/admin/media/${media.id}`,
      { version: media.version },
    );
    expect(failed.status).toBe(503);
    expect(apiErrorSchema.parse(failed.body).error.code).toBe(
      "MEDIA_CLEANUP_FAILED",
    );
    const deleting = await MediaModel.findById(media.id);
    expect(deleting?.status).toBe("deleting");

    const referenceAttempt = await mutation(
      auth,
      "post",
      "/api/v1/admin/categories",
      {
        slug: "blocked-during-delete",
        translations: { en: { name: "Blocked during delete" } },
        image: {
          mediaId: media.id,
          translations: { en: { alt: "Unavailable image" } },
        },
      },
    );
    expect(referenceAttempt.status).toBe(409);
    expect(apiErrorSchema.parse(referenceAttempt.body).error.code).toBe(
      "MEDIA_NOT_READY",
    );

    provider.failDelete = false;
    await mutation(
      auth,
      "delete",
      `/api/v1/admin/media/${media.id}`,
      { version: media.version },
    ).expect(200);
    expect(await MediaModel.findById(media.id)).toBeNull();

    await mutation(
      auth,
      "delete",
      `/api/v1/admin/media/${media.id}`,
      { version: 0 },
    ).expect(404);
  });
});
