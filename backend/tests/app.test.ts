import { apiErrorSchema, apiSuccessSchema, healthDtoSchema } from "@maglive/contracts";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestConfig } from "./helpers/config.js";

describe("Express foundation", () => {
  it("reports API and database readiness without configuration details", async () => {
    const app = createApp({
      config: createTestConfig(),
      databaseHealth: () => ({ status: "ready" })
    });
    const response = await request(app).get("/api/v1/health").expect(200);
    const body = apiSuccessSchema(healthDtoSchema).parse(response.body);
    expect(body.data).toEqual({
      status: "ok",
      api: "ready",
      database: { status: "ready" }
    });
    expect(JSON.stringify(body)).not.toContain("mongodb://");
  });

  it("returns 503 while the database is not ready", async () => {
    const app = createApp({
      config: createTestConfig(),
      databaseHealth: () => ({ status: "not-ready" })
    });
    const response = await request(app).get("/api/v1/health").expect(503);
    expect(healthDtoSchema.parse(response.body.data).status).toBe("degraded");
  });

  it("normalizes unknown routes, malformed JSON, and oversized JSON", async () => {
    const app = createApp({
      config: createTestConfig({ jsonBodyLimitBytes: 128 }),
      databaseHealth: () => ({ status: "ready" })
    });

    const missing = await request(app).get("/api/v1/missing").expect(404);
    expect(apiErrorSchema.parse(missing.body).error.code).toBe("API_ROUTE_NOT_FOUND");
    expect(missing.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/i);

    const malformed = await request(app)
      .post("/api/v1/missing")
      .set("Content-Type", "application/json")
      .send('{"broken":')
      .expect(400);
    expect(apiErrorSchema.parse(malformed.body).error.code).toBe("MALFORMED_JSON");

    const oversized = await request(app)
      .post("/api/v1/missing")
      .send({ value: "x".repeat(256) })
      .expect(413);
    expect(apiErrorSchema.parse(oversized.body).error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("allows the configured credentialed origin and rejects foreign origins", async () => {
    const app = createApp({
      config: createTestConfig(),
      databaseHealth: () => ({ status: "ready" })
    });

    const allowed = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3000")
      .expect(200);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(allowed.headers["access-control-allow-credentials"]).toBe("true");

    const denied = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://foreign.example")
      .expect(403);
    expect(apiErrorSchema.parse(denied.body).error.code).toBe("CORS_ORIGIN_DENIED");
  });
});
