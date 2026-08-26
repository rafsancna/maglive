import path from "node:path";
import type { AppConfig } from "../../src/config/env.js";

export function createTestConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: "test",
    port: 5000,
    mongoUri: "mongodb://localhost:27017/maglive_test?replicaSet=maglive-rs",
    frontendOrigin: "http://localhost:3000",
    sessionSecret: "test-session-secret-00000000000000000000",
    previewSigningSecret: "test-preview-signing-000000000000000000",
    previewExchangeSecret: "test-preview-exchange-0000000000000000",
    uploadRoot: path.resolve("uploads-test-never-used"),
    publicMediaBaseUrl: "http://localhost:5000/uploads",
    maxImageBytes: 15 * 1024 * 1024,
    maxVideoBytes: 250 * 1024 * 1024,
    maxDocumentBytes: 50 * 1024 * 1024,
    nextRevalidationUrl: "http://localhost:3000/api/internal/revalidate",
    nextRevalidationSecret: "test-revalidation-secret-000000000000000",
    trustProxy: false,
    jsonBodyLimitBytes: 1024 * 1024,
    ...overrides
  };
}
