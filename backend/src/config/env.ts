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

/**
 * Absolute URL of a CDN/bucket, or a root-relative path such as `/uploads`.
 * An empty value means "follow the origin of the incoming request", which keeps
 * media links valid on any domain, IP address or port.
 */
const publicMediaBaseUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .default("")
  .superRefine((value, context) => {
    if (value === "") return;
    if (value.startsWith("/")) {
      if (value.startsWith("//") || /\s/.test(value)) {
        context.addIssue({
          code: "custom",
          message: "Expected a root-relative path without spaces, such as /uploads",
        });
      }
      return;
    }
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        context.addIssue({ code: "custom", message: "Expected an http(s) URL" });
      }
      if (url.search !== "" || url.hash !== "") {
        context.addIssue({
          code: "custom",
          message: "Expected a base URL without query or fragment",
        });
      }
    } catch {
      context.addIssue({
        code: "custom",
        message: "Expected an absolute http(s) URL or a root-relative path",
      });
    }
  });

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(5000),
  MONGODB_URI: mongoUriSchema,
  FRONTEND_ORIGIN: originSchema,
  SESSION_SECRET: secretSchema,
  PREVIEW_SIGNING_SECRET: secretSchema,
  PREVIEW_EXCHANGE_SECRET: secretSchema,
  UPLOAD_ROOT: z.string().min(1).transform((value) => path.resolve(value)),
  PUBLIC_MEDIA_BASE_URL: publicMediaBaseUrlSchema,
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(15 * 1024 * 1024),
  MAX_VIDEO_BYTES: z.coerce.number().int().positive().default(250 * 1024 * 1024),
  MAX_DOCUMENT_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  REDIS_URL: z.url().default("redis://127.0.0.1:6379"),
  FFMPEG_PATH: z.string().min(1).default("ffmpeg"),
  FFPROBE_PATH: z.string().min(1).default("ffprobe"),
  IMAGE_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  VIDEO_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(1),
  MEDIA_JOB_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  MEDIA_SOURCE_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  NEXT_REVALIDATION_URL: z.url(),
  NEXT_REVALIDATION_SECRET: secretSchema,
  TRUST_PROXY: trustProxySchema.default(false),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().min(1).max(1_440).default(30),
  SESSION_ABSOLUTE_TIMEOUT_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(100).default(5),
  ADMIN_MUTATION_RATE_LIMIT_MAX: z.coerce.number().int().min(1).max(1_000).default(120),
  GOOGLE_SEARCH_CONSOLE_SITE: z.url().optional(),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().email().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  BING_WEBMASTER_API_KEY: z.string().min(1).optional(),
  BAIDU_SITE: z.url().optional(),
  BAIDU_TOKEN: z.string().min(1).optional(),
  YANDEX_OAUTH_TOKEN: z.string().min(1).optional(),
  INDEXNOW_KEY: z.string().regex(/^[a-f0-9-]{8,128}$/i).optional(),
  INDEXNOW_KEY_LOCATION: z.url().optional()
}).superRefine((value, context) => {
  if (value.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 < value.SESSION_IDLE_TIMEOUT_MINUTES) {
    context.addIssue({
      code: "custom",
      path: ["SESSION_ABSOLUTE_TIMEOUT_HOURS"],
      message: "Absolute session timeout must not be shorter than the idle timeout"
    });
  }
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
  redisUrl: string;
  ffmpegPath: string;
  ffprobePath: string;
  imageWorkerConcurrency: number;
  videoWorkerConcurrency: number;
  mediaJobAttempts: number;
  mediaSourceRetentionMs: number;
  nextRevalidationUrl: string;
  nextRevalidationSecret: string;
  trustProxy: false | number;
  jsonBodyLimitBytes: number;
  sessionIdleTimeoutMs: number;
  sessionAbsoluteTimeoutMs: number;
  loginRateLimitMax: number;
  adminMutationRateLimitMax: number;
  googleSearchConsoleSite?: string;
  googleServiceAccountEmail?: string;
  googleServiceAccountPrivateKey?: string;
  bingWebmasterApiKey?: string;
  baiduSite?: string;
  baiduToken?: string;
  yandexOauthToken?: string;
  indexNowKey?: string;
  indexNowKeyLocation?: string;
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
    redisUrl: result.data.REDIS_URL,
    ffmpegPath: result.data.FFMPEG_PATH,
    ffprobePath: result.data.FFPROBE_PATH,
    imageWorkerConcurrency: result.data.IMAGE_WORKER_CONCURRENCY,
    videoWorkerConcurrency: result.data.VIDEO_WORKER_CONCURRENCY,
    mediaJobAttempts: result.data.MEDIA_JOB_ATTEMPTS,
    mediaSourceRetentionMs: result.data.MEDIA_SOURCE_RETENTION_HOURS * 60 * 60 * 1_000,
    nextRevalidationUrl: result.data.NEXT_REVALIDATION_URL,
    nextRevalidationSecret: result.data.NEXT_REVALIDATION_SECRET,
    trustProxy: result.data.TRUST_PROXY,
    jsonBodyLimitBytes: 1024 * 1024,
    sessionIdleTimeoutMs: result.data.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1_000,
    sessionAbsoluteTimeoutMs: result.data.SESSION_ABSOLUTE_TIMEOUT_HOURS * 60 * 60 * 1_000,
    loginRateLimitMax: result.data.LOGIN_RATE_LIMIT_MAX,
    adminMutationRateLimitMax: result.data.ADMIN_MUTATION_RATE_LIMIT_MAX,
    ...(result.data.GOOGLE_SEARCH_CONSOLE_SITE === undefined ? {} : { googleSearchConsoleSite: result.data.GOOGLE_SEARCH_CONSOLE_SITE }),
    ...(result.data.GOOGLE_SERVICE_ACCOUNT_EMAIL === undefined ? {} : { googleServiceAccountEmail: result.data.GOOGLE_SERVICE_ACCOUNT_EMAIL }),
    ...(result.data.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY === undefined ? {} : { googleServiceAccountPrivateKey: result.data.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY }),
    ...(result.data.BING_WEBMASTER_API_KEY === undefined ? {} : { bingWebmasterApiKey: result.data.BING_WEBMASTER_API_KEY }),
    ...(result.data.BAIDU_SITE === undefined ? {} : { baiduSite: result.data.BAIDU_SITE }),
    ...(result.data.BAIDU_TOKEN === undefined ? {} : { baiduToken: result.data.BAIDU_TOKEN }),
    ...(result.data.YANDEX_OAUTH_TOKEN === undefined ? {} : { yandexOauthToken: result.data.YANDEX_OAUTH_TOKEN }),
    ...(result.data.INDEXNOW_KEY === undefined ? {} : { indexNowKey: result.data.INDEXNOW_KEY }),
    ...(result.data.INDEXNOW_KEY_LOCATION === undefined ? {} : { indexNowKeyLocation: result.data.INDEXNOW_KEY_LOCATION }),
  };
}
