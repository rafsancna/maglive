import path from "node:path";
import { z } from "zod";

const mongoUriSchema = z
  .string()
  .min(1)
  .regex(/^mongodb(?:\+srv)?:\/\//, "Expected a MongoDB connection URI");

const originSchema = z.url().transform((value, context) => {
  const url = new URL(value);
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    context.addIssue({
      code: "custom",
      message: "Expected an origin without path, query, or fragment"
    });
    return z.NEVER;
  }
  return url.origin;
});

const trustProxySchema = z.preprocess((value) => {
  if (value === undefined || value === "" || value === "false" || value === false) {
    return false;
  }
  if (value === "true" || value === true) {
    return 1;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return value;
}, z.union([z.literal(false), z.number().int().min(0).max(10)]));

const secretSchema = z.string().min(32, "Secret must contain at least 32 characters");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
  MONGODB_URI: mongoUriSchema,
  FRONTEND_ORIGIN: originSchema,
  SESSION_SECRET: secretSchema,
  PREVIEW_SIGNING_SECRET: secretSchema,
  PREVIEW_EXCHANGE_SECRET: secretSchema,
  UPLOAD_ROOT: z.string().min(1).transform((value) => path.resolve(value)),
  PUBLIC_MEDIA_BASE_URL: z.url().transform((value) => value.replace(/\/$/, "")),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(250 * 1024 * 1024),
  MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  NEXT_REVALIDATION_URL: z.url(),
  NEXT_REVALIDATION_SECRET: secretSchema,
  TRUST_PROXY: trustProxySchema.default(false)
});

export type AppConfig = Readonly<{
  nodeEnv: "development" | "test" | "production";
  port: number;
  mongoUri: string;
  frontendOrigin: string;
  sessionSecret: string;
  previewSigningSecret: string;
  previewExchangeSecret: string;
  uploadRoot: string;
  publicMediaBaseUrl: string;
  maxImageBytes: number;
  maxVideoBytes: number;
  maxDocumentBytes: number;
  nextRevalidationUrl: string;
  nextRevalidationSecret: string;
  trustProxy: false | number;
  jsonBodyLimitBytes: number;
}>;

export class ConfigurationError extends Error {
  constructor(public readonly issues: readonly string[]) {
    super(`Invalid environment configuration:\n${issues.join("\n")}`);
    this.name = "ConfigurationError";
  }
}

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new ConfigurationError(
      result.error.issues.map((issue) => `${issue.path.join(".") || "environment"}: ${issue.message}`)
    );
  }

  return {
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    mongoUri: result.data.MONGODB_URI,
    frontendOrigin: result.data.FRONTEND_ORIGIN,
    sessionSecret: result.data.SESSION_SECRET,
    previewSigningSecret: result.data.PREVIEW_SIGNING_SECRET,
    previewExchangeSecret: result.data.PREVIEW_EXCHANGE_SECRET,
    uploadRoot: result.data.UPLOAD_ROOT,
    publicMediaBaseUrl: result.data.PUBLIC_MEDIA_BASE_URL,
    maxImageBytes: result.data.MAX_IMAGE_BYTES,
    maxVideoBytes: result.data.MAX_VIDEO_BYTES,
    maxDocumentBytes: result.data.MAX_DOCUMENT_BYTES,
    nextRevalidationUrl: result.data.NEXT_REVALIDATION_URL,
    nextRevalidationSecret: result.data.NEXT_REVALIDATION_SECRET,
    trustProxy: result.data.TRUST_PROXY,
    jsonBodyLimitBytes: 1024 * 1024
  };
}
