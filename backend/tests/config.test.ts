import { describe, expect, it } from "vitest";
import { ConfigurationError, loadConfig } from "../src/config/env.js";

const validEnvironment = {
  NODE_ENV: "test",
  PORT: "5000",
  MONGODB_URI: "mongodb://localhost:27017/maglive_test?replicaSet=maglive-rs",
  FRONTEND_ORIGIN: "http://localhost:3000",
  SESSION_SECRET: "test-session-secret-00000000000000000000",
  PREVIEW_SIGNING_SECRET: "test-preview-signing-000000000000000000",
  PREVIEW_EXCHANGE_SECRET: "test-preview-exchange-0000000000000000",
  UPLOAD_ROOT: "./uploads",
  PUBLIC_MEDIA_BASE_URL: "http://localhost:5000/uploads",
  NEXT_REVALIDATION_URL: "http://localhost:3000/api/internal/revalidate",
  NEXT_REVALIDATION_SECRET: "test-revalidation-secret-000000000000000",
  TRUST_PROXY: "false"
} satisfies NodeJS.ProcessEnv;

describe("environment configuration", () => {
  it("parses safe defaults and normalizes origins", () => {
    const config = loadConfig(validEnvironment);
    expect(config.port).toBe(5000);
    expect(config.frontendOrigin).toBe("http://localhost:3000");
    expect(config.maxImageBytes).toBe(15 * 1024 * 1024);
    expect(config.trustProxy).toBe(false);
    expect(config.sessionIdleTimeoutMs).toBe(30 * 60 * 1_000);
    expect(config.sessionAbsoluteTimeoutMs).toBe(8 * 60 * 60 * 1_000);
  });

  it("fails startup configuration for missing or short secrets", () => {
    expect(() => loadConfig({ ...validEnvironment, MONGODB_URI: undefined })).toThrow(
      ConfigurationError
    );

    expect(() => loadConfig({ ...validEnvironment, SESSION_SECRET: "short" })).toThrow(
      /SESSION_SECRET/
    );
  });

  it("rejects a credentialed origin with a path", () => {
    expect(() =>
      loadConfig({ ...validEnvironment, FRONTEND_ORIGIN: "http://localhost:3000/app" })
    ).toThrow(/FRONTEND_ORIGIN/);
  });

  it("accepts a relative or empty public media base URL", () => {
    expect(loadConfig({ ...validEnvironment, PUBLIC_MEDIA_BASE_URL: "" }).publicMediaBaseUrl).toBe("");
    expect(
      loadConfig({ ...validEnvironment, PUBLIC_MEDIA_BASE_URL: "/library" }).publicMediaBaseUrl
    ).toBe("/library");
    expect(
      loadConfig({ ...validEnvironment, PUBLIC_MEDIA_BASE_URL: undefined }).publicMediaBaseUrl
    ).toBe("");
    expect(() =>
      loadConfig({ ...validEnvironment, PUBLIC_MEDIA_BASE_URL: "localhost:5000/uploads" })
    ).toThrow(/PUBLIC_MEDIA_BASE_URL/);
    expect(() =>
      loadConfig({ ...validEnvironment, PUBLIC_MEDIA_BASE_URL: "ftp://localhost/uploads" })
    ).toThrow(/PUBLIC_MEDIA_BASE_URL/);
  });

  it("rejects an absolute session lifetime shorter than its idle window", () => {
    expect(() =>
      loadConfig({
        ...validEnvironment,
        SESSION_IDLE_TIMEOUT_MINUTES: "121",
        SESSION_ABSOLUTE_TIMEOUT_HOURS: "2"
      })
    ).toThrow(/SESSION_ABSOLUTE_TIMEOUT_HOURS/);
  });
});
