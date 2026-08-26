import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  apiErrorSchema,
  apiSuccessSchema,
  authenticatedSessionDtoSchema,
  csrfDtoSchema,
  logoutDtoSchema,
  safeAdminDtoSchema
} from "@maglive/contracts";
import session from "express-session";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { hashPassword, passwordHashNeedsUpgrade, verifyPassword } from "../src/auth/password.js";
import { connectDatabase, disconnectDatabase } from "../src/config/database.js";
import {
  SESSION_COLLECTION_NAME,
  SESSION_COOKIE_NAME,
  createMongoSessionStore
} from "../src/config/session.js";
import { UserModel } from "../src/models/User.js";
import {
  AdministratorAlreadyExistsError,
  bootstrapAdministrator
} from "../src/services/adminBootstrap.js";
import { createTestConfig } from "./helpers/config.js";

const executeFile = promisify(execFile);
const frontendOrigin = "http://localhost:3000";
let replicaSet: MongoMemoryReplSet;
let mongoUri: string;

function setCookies(response: request.Response): string[] {
  const header: unknown = response.headers["set-cookie"];
  if (Array.isArray(header)) {
    return header.filter((value): value is string => typeof value === "string");
  }
  return typeof header === "string" ? [header] : [];
}

function sessionCookie(response: request.Response): string {
  const cookie = setCookies(response).find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (cookie === undefined) {
    throw new Error("Expected an administrator session cookie.");
  }
  return cookie.split(";", 1)[0] ?? cookie;
}

async function csrf(agent: ReturnType<typeof request.agent>): Promise<string> {
  const response = await agent.get("/api/v1/admin/auth/csrf").expect(200);
  return apiSuccessSchema(csrfDtoSchema).parse(response.body).data.csrfToken;
}

async function createAdministrator(
  password = "Correct horse battery staple 42!",
  active = true
) {
  const result = await bootstrapAdministrator({
    email: "Admin@Example.COM",
    password,
    updateExisting: false
  });
  if (!active) {
    await UserModel.updateOne({ _id: result.admin.id }, { active: false });
  }
  return result.admin;
}

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });
  mongoUri = replicaSet.getUri("maglive_test");
  await connectDatabase(mongoUri);
  await UserModel.syncIndexes();
}, 180_000);

beforeEach(async () => {
  await UserModel.deleteMany({});
  await mongoose.connection.collection(SESSION_COLLECTION_NAME).deleteMany({});
});

afterAll(async () => {
  await disconnectDatabase();
  await replicaSet.stop();
}, 60_000);

describe.sequential("administrator identity", () => {
  it("hashes with Argon2id and excludes the hash from normal reads and serialization", async () => {
    const plaintext = "Correct horse battery staple 42!";
    const passwordHash = await hashPassword(plaintext);
    expect(passwordHash).not.toBe(plaintext);
    expect(passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(passwordHash, plaintext)).toBe(true);
    expect(await verifyPassword(passwordHash, "wrong password")).toBe(false);
    expect(await verifyPassword("forged-hash", plaintext)).toBe(false);
    expect(passwordHashNeedsUpgrade(passwordHash)).toBe(false);

    const admin = await createAdministrator(plaintext);
    const normalRead = await UserModel.findById(admin.id);
    expect(normalRead?.passwordHash).toBeUndefined();
    expect(JSON.stringify(normalRead)).not.toContain("passwordHash");
    expect(JSON.stringify(normalRead)).not.toContain(plaintext);
  });

  it("normalizes, creates, rejects duplicates, and explicitly updates one administrator", async () => {
    const created = await createAdministrator();
    expect(created.email).toBe("admin@example.com");
    expect(await UserModel.countDocuments()).toBe(1);

    await expect(
      bootstrapAdministrator({
        email: " admin@example.com ",
        password: "A different secure password 43!",
        updateExisting: false
      })
    ).rejects.toBeInstanceOf(AdministratorAlreadyExistsError);

    const updated = await bootstrapAdministrator({
      email: "ADMIN@example.com",
      password: "A different secure password 43!",
      updateExisting: true
    });
    expect(updated.action).toBe("updated");
    expect(await UserModel.countDocuments()).toBe(1);
    const selected = await UserModel.findById(created.id).select("+passwordHash");
    expect(selected?.passwordChangedAt).toBeInstanceOf(Date);
    expect(await verifyPassword(selected?.passwordHash ?? "", "A different secure password 43!")).toBe(
      true
    );
  });

  it("runs the environment-fed bootstrap CLI without exposing its password", async () => {
    const password = "CLI-only secure password 44!";
    const result = await executeFile(
      process.execPath,
      ["--import", "tsx", "src/scripts/createAdmin.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "test",
          MONGODB_URI: mongoUri,
          FRONTEND_ORIGIN: frontendOrigin,
          SESSION_SECRET: "test-session-secret-00000000000000000000",
          PREVIEW_SIGNING_SECRET: "test-preview-signing-000000000000000000",
          PREVIEW_EXCHANGE_SECRET: "test-preview-exchange-0000000000000000",
          UPLOAD_ROOT: "./uploads-test-never-used",
          PUBLIC_MEDIA_BASE_URL: "http://localhost:5000/uploads",
          NEXT_REVALIDATION_URL: "http://localhost:3000/api/internal/revalidate",
          NEXT_REVALIDATION_SECRET: "test-revalidation-secret-000000000000000",
          ADMIN_EMAIL: "cli-admin@example.com",
          ADMIN_PASSWORD: password,
          ADMIN_UPDATE_EXISTING: "false"
        }
      }
    );

    expect(result.stdout).toContain("Administrator created: cli-admin@example.com");
    expect(`${result.stdout}${result.stderr}`).not.toContain(password);
    expect(await UserModel.countDocuments({ email: "cli-admin@example.com" })).toBe(1);
  }, 30_000);
});

describe.sequential("administrator HTTP authentication", () => {
  it("rotates the pre-auth session, persists across app instances, and logs out destructively", async () => {
    const password = "Correct horse battery staple 42!";
    await createAdministrator(password);
    const config = createTestConfig({ mongoUri });
    const appBeforeRestart = createApp({
      config,
      sessionStore: createMongoSessionStore(config)
    });
    const agent = request.agent(appBeforeRestart);

    const csrfResponse = await agent.get("/api/v1/admin/auth/csrf").expect(200);
    const preAuthToken = apiSuccessSchema(csrfDtoSchema).parse(csrfResponse.body).data.csrfToken;
    const preAuthCookie = sessionCookie(csrfResponse);
    const cookieAttributes = setCookies(csrfResponse).join(";");
    expect(cookieAttributes).toContain("HttpOnly");
    expect(cookieAttributes).toContain("SameSite=Lax");
    expect(cookieAttributes).toContain("Path=/");
    expect(cookieAttributes).not.toContain("Secure");
    expect(cookieAttributes).not.toContain("connect.sid");

    const loginResponse = await agent
      .post("/api/v1/admin/auth/login")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", preAuthToken)
      .send({ email: " ADMIN@example.com ", password })
      .expect(200);
    const authenticated = apiSuccessSchema(authenticatedSessionDtoSchema).parse(loginResponse.body)
      .data;
    const authenticatedCookie = sessionCookie(loginResponse);
    expect(authenticatedCookie).not.toBe(preAuthCookie);
    expect(authenticated.admin.email).toBe("admin@example.com");
    expect(JSON.stringify(authenticated.admin)).not.toContain("passwordHash");
    const storedSession = await mongoose.connection
      .collection(SESSION_COLLECTION_NAME)
      .findOne({});
    expect(JSON.stringify(storedSession)).not.toContain("admin@example.com");
    expect(JSON.stringify(storedSession)).not.toContain(authenticated.csrfToken);
    const sessionIndexes = await mongoose.connection
      .collection(SESSION_COLLECTION_NAME)
      .indexes();
    expect(sessionIndexes.some((index) => index.expireAfterSeconds === 0)).toBe(true);

    await agent
      .post("/api/v1/admin/auth/logout")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", preAuthToken)
      .expect(403);

    const appAfterRestart = createApp({
      config,
      sessionStore: createMongoSessionStore(config)
    });
    const me = await request(appAfterRestart)
      .get("/api/v1/admin/auth/me")
      .set("Cookie", authenticatedCookie)
      .expect(200);
    expect(apiSuccessSchema(safeAdminDtoSchema).parse(me.body).data.email).toBe(
      "admin@example.com"
    );

    const logout = await request(appAfterRestart)
      .post("/api/v1/admin/auth/logout")
      .set("Cookie", authenticatedCookie)
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", authenticated.csrfToken)
      .expect(200);
    expect(apiSuccessSchema(logoutDtoSchema).parse(logout.body).data.loggedOut).toBe(true);
    expect(setCookies(logout).join(";")).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(await mongoose.connection.collection(SESSION_COLLECTION_NAME).countDocuments()).toBe(0);

    const afterLogout = await request(appAfterRestart)
      .get("/api/v1/admin/auth/me")
      .set("Cookie", authenticatedCookie)
      .expect(401);
    expect(apiErrorSchema.parse(afterLogout.body).error.code).toBe("SESSION_EXPIRED");
  });

  it("returns one generic error for missing, inactive, and incorrect accounts", async () => {
    const password = "Correct horse battery staple 42!";
    await createAdministrator(password);
    const config = createTestConfig({ mongoUri });
    const app = createApp({ config, sessionStore: createMongoSessionStore(config) });

    async function rejectedLogin(email: string, candidate: string) {
      const agent = request.agent(app);
      const token = await csrf(agent);
      const response = await agent
        .post("/api/v1/admin/auth/login")
        .set("Origin", frontendOrigin)
        .set("X-CSRF-Token", token)
        .send({ email, password: candidate })
        .expect(401);
      const error = apiErrorSchema.parse(response.body).error;
      return { code: error.code, message: error.message };
    }

    const incorrect = await rejectedLogin("admin@example.com", "incorrect password");
    const missing = await rejectedLogin("missing@example.com", "incorrect password");
    await UserModel.updateOne({ email: "admin@example.com" }, { active: false });
    const inactive = await rejectedLogin("admin@example.com", password);
    expect(missing).toEqual(incorrect);
    expect(inactive).toEqual(incorrect);
    expect(incorrect.code).toBe("INVALID_CREDENTIALS");
  });

  it("rejects missing, wrong, stale, reused, and cross-origin CSRF attempts", async () => {
    const password = "Correct horse battery staple 42!";
    await createAdministrator(password);
    let nowMs = Date.now();
    const config = createTestConfig({ mongoUri });
    const app = createApp({
      config,
      sessionStore: createMongoSessionStore(config),
      now: () => nowMs
    });
    const agent = request.agent(app);
    const token = await csrf(agent);

    const missingToken = await agent
      .post("/api/v1/admin/auth/login")
      .set("Origin", frontendOrigin)
      .send({ email: "admin@example.com", password })
      .expect(403);
    expect(apiErrorSchema.parse(missingToken.body).error.code).toBe("CSRF_INVALID");

    await agent
      .post("/api/v1/admin/auth/login")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", "wrong-token-value-that-is-long-enough")
      .send({ email: "admin@example.com", password })
      .expect(403);

    await agent
      .post("/api/v1/admin/auth/login")
      .set("X-CSRF-Token", token)
      .send({ email: "admin@example.com", password })
      .expect(403);

    const foreign = await agent
      .post("/api/v1/admin/auth/login")
      .set("Origin", "https://foreign.example")
      .set("X-CSRF-Token", token)
      .send({ email: "admin@example.com", password })
      .expect(403);
    expect(apiErrorSchema.parse(foreign.body).error.code).toBe("CORS_ORIGIN_DENIED");

    nowMs += 31 * 60 * 1_000;
    const stale = await agent
      .post("/api/v1/admin/auth/login")
      .set("Referer", `${frontendOrigin}/admin/login`)
      .set("X-CSRF-Token", token)
      .send({ email: "admin@example.com", password })
      .expect(403);
    expect(apiErrorSchema.parse(stale.body).error.code).toBe("CSRF_INVALID");
  });

  it("enforces login rate limits by IP and normalized account key", async () => {
    await createAdministrator();
    const config = createTestConfig({ mongoUri, loginRateLimitMax: 2 });
    const app = createApp({ config, sessionStore: createMongoSessionStore(config) });
    const agent = request.agent(app);
    const token = await csrf(agent);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await agent
        .post("/api/v1/admin/auth/login")
        .set("Origin", frontendOrigin)
        .set("X-CSRF-Token", token)
        .send({ email: "ADMIN@example.com", password: "wrong password" })
        .expect(401);
    }

    const limited = await agent
      .post("/api/v1/admin/auth/login")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", token)
      .send({ email: " admin@example.com ", password: "wrong password" })
      .expect(429);
    expect(apiErrorSchema.parse(limited.body).error.code).toBe("RATE_LIMITED");
  });

  it("enforces idle and absolute expiry and production cookie security", async () => {
    const password = "Correct horse battery staple 42!";
    await createAdministrator(password);
    let nowMs = Date.now();
    const config = createTestConfig({ mongoUri });
    const app = createApp({
      config,
      sessionStore: createMongoSessionStore(config),
      now: () => nowMs
    });
    const agent = request.agent(app);
    const token = await csrf(agent);
    await agent
      .post("/api/v1/admin/auth/login")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", token)
      .send({ email: "admin@example.com", password })
      .expect(200);

    nowMs += config.sessionIdleTimeoutMs + 1;
    const expired = await agent.get("/api/v1/admin/auth/me").expect(401);
    expect(apiErrorSchema.parse(expired.body).error.code).toBe("SESSION_EXPIRED");

    nowMs = Date.now();
    const absoluteConfig = createTestConfig({
      mongoUri,
      sessionIdleTimeoutMs: 2 * 60 * 60 * 1_000,
      sessionAbsoluteTimeoutMs: 60 * 60 * 1_000
    });
    const absoluteApp = createApp({
      config: absoluteConfig,
      sessionStore: createMongoSessionStore(absoluteConfig),
      now: () => nowMs
    });
    const absoluteAgent = request.agent(absoluteApp);
    const absoluteCsrf = await csrf(absoluteAgent);
    await absoluteAgent
      .post("/api/v1/admin/auth/login")
      .set("Origin", frontendOrigin)
      .set("X-CSRF-Token", absoluteCsrf)
      .send({ email: "admin@example.com", password })
      .expect(200);
    nowMs += absoluteConfig.sessionAbsoluteTimeoutMs + 1;
    const absoluteExpired = await absoluteAgent.get("/api/v1/admin/auth/me").expect(401);
    expect(apiErrorSchema.parse(absoluteExpired.body).error.code).toBe("SESSION_EXPIRED");

    const productionConfig = createTestConfig({ nodeEnv: "production", trustProxy: 1 });
    const productionApp = createApp({
      config: productionConfig,
      sessionStore: new session.MemoryStore()
    });
    const productionCsrf = await request(productionApp)
      .get("/api/v1/admin/auth/csrf")
      .set("X-Forwarded-Proto", "https")
      .expect(200);
    expect(setCookies(productionCsrf).join(";")).toContain("Secure");
  });

  it("rejects protected APIs without a session", async () => {
    const config = createTestConfig({ mongoUri });
    const app = createApp({ config, sessionStore: createMongoSessionStore(config) });
    const response = await request(app).get("/api/v1/admin/auth/me").expect(401);
    expect(apiErrorSchema.parse(response.body).error.code).toBe("AUTH_REQUIRED");
  });
});
