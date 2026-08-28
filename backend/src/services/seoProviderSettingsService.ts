import { createCipheriv, createDecipheriv, createHash, createSign, randomBytes } from "node:crypto";
import {
  seoConnectionProviderSchema,
  seoProviderCredentialsSchema,
  seoProviderSettingsResponseSchema,
  seoProviderSettingsSchema,
  seoProviderSettingsUpdateSchema,
  seoProviderTestRequestSchema,
  type SeoConnectionProvider,
  type SeoProviderCredentials,
  type SeoProviderSettings,
  type SeoProviderSettingsUpdate,
} from "@maglive/contracts";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { SeoProviderSettingModel, type SeoProviderSettingDocument } from "../models/SeoProviderSetting.js";

const providers = ["google", "bing", "baidu", "yandex", "indexnow"] as const;
const emptyCredentials: SeoProviderCredentials = {};

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? value as JsonRecord : {};
}

function encryptionKey(config: AppConfig): Buffer {
  return createHash("sha256").update(config.sessionSecret, "utf8").digest();
}

function encryptCredentials(credentials: SeoProviderCredentials, config: AppConfig): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(config), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

function decryptCredentials(value: string, config: AppConfig): SeoProviderCredentials {
  try {
    const [ivText, tagText, ciphertextText] = value.split(".");
    if (!ivText || !tagText || !ciphertextText) return emptyCredentials;
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(config), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
    return seoProviderCredentialsSchema.parse(JSON.parse(plaintext));
  } catch {
    throw new AppError(500, "SEO_SETTINGS_UNREADABLE", "Stored search provider settings could not be decrypted.");
  }
}

function hasCredentials(credentials: SeoProviderCredentials): boolean {
  return Object.values(credentials).some((value) => typeof value === "string" && value.trim() !== "");
}

function credentialHint(provider: SeoConnectionProvider, credentials: SeoProviderCredentials): string | undefined {
  const value = credentials.clientEmail ?? credentials.apiKey ?? credentials.token ?? credentials.key;
  if (value === undefined || value === "") return undefined;
  if (provider === "google" && credentials.clientEmail !== undefined) return credentials.clientEmail;
  return value.length <= 8 ? "configured" : `****${value.slice(-4)}`;
}

function defaultMessage(provider: SeoConnectionProvider): string {
  return provider === "baidu"
    ? "Credentials saved. Baidu does not expose a harmless read-only credential check; the first URL submission will verify access."
    : "Credentials saved. Test the connection to verify access.";
}

function toDto(record: SeoProviderSettingDocument | undefined, provider: SeoConnectionProvider, safeCredentials?: SeoProviderCredentials): SeoProviderSettings {
  if (record === undefined && safeCredentials !== undefined && hasCredentials(safeCredentials)) {
    return seoProviderSettingsSchema.parse({
      provider,
      ...(safeCredentials.site === undefined ? {} : { site: safeCredentials.site }),
      enabled: true,
      configured: true,
      status: "configured",
      message: defaultMessage(provider),
      ...(credentialHint(provider, safeCredentials) === undefined ? {} : { credentialHint: credentialHint(provider, safeCredentials) }),
    });
  }
  if (record === undefined) {
    return { provider, enabled: false, configured: false, status: "not-configured", message: "No credentials configured." };
  }
  return seoProviderSettingsSchema.parse({
    provider,
    ...(safeCredentials?.site === undefined ? {} : { site: safeCredentials.site }),
    enabled: record.enabled,
    configured: record.configured ?? record.credentialHint !== undefined,
    status: record.status,
    message: record.message,
    ...(record.lastCheckedAt === undefined ? {} : { lastCheckedAt: record.lastCheckedAt.toISOString() }),
    ...(record.credentialHint === undefined ? {} : { credentialHint: record.credentialHint }),
  });
}

function transientDto(
  provider: SeoConnectionProvider,
  credentials: SeoProviderCredentials,
  status: SeoProviderSettings["status"],
  message: string,
): SeoProviderSettings {
  return seoProviderSettingsSchema.parse({
    provider,
    ...(credentials.site === undefined ? {} : { site: credentials.site }),
    enabled: true,
    configured: hasCredentials(credentials),
    status,
    message,
    ...(credentialHint(provider, credentials) === undefined ? {} : { credentialHint: credentialHint(provider, credentials) }),
  });
}

export function storedProviderCredentials(provider: SeoConnectionProvider, config: AppConfig): Promise<SeoProviderCredentials> {
  return SeoProviderSettingModel.findOne({ provider }).then((record) => record === null ? emptyCredentials : decryptCredentials(record.credentialsEncrypted, config));
}

function environmentProviderCredentials(provider: SeoConnectionProvider, config: AppConfig): SeoProviderCredentials {
  if (provider === "google") return {
    ...(config.googleSearchConsoleSite === undefined ? {} : { site: config.googleSearchConsoleSite }),
    ...(config.googleServiceAccountEmail === undefined ? {} : { clientEmail: config.googleServiceAccountEmail }),
    ...(config.googleServiceAccountPrivateKey === undefined ? {} : { privateKey: config.googleServiceAccountPrivateKey }),
  };
  if (provider === "bing") return {
    ...(config.bingWebmasterApiKey === undefined ? {} : { apiKey: config.bingWebmasterApiKey }),
  };
  if (provider === "baidu") return {
    ...(config.baiduSite === undefined ? {} : { site: config.baiduSite }),
    ...(config.baiduToken === undefined ? {} : { token: config.baiduToken }),
  };
  if (provider === "yandex") return {
    ...(config.yandexOauthToken === undefined ? {} : { token: config.yandexOauthToken }),
  };
  return {
    ...(config.indexNowKey === undefined ? {} : { key: config.indexNowKey }),
    ...(config.indexNowKeyLocation === undefined ? {} : { keyLocation: config.indexNowKeyLocation }),
  };
}

export async function effectiveProviderCredentials(provider: SeoConnectionProvider, config: AppConfig): Promise<SeoProviderCredentials> {
  const [stored, record] = await Promise.all([
    storedProviderCredentials(provider, config),
    SeoProviderSettingModel.findOne({ provider }).select("enabled"),
  ]);
  if (record !== null && record.enabled === false) return emptyCredentials;
  return { ...environmentProviderCredentials(provider, config), ...stored };
}

export async function listSeoProviderSettings(config: AppConfig) {
  const records = await SeoProviderSettingModel.find({ provider: { $in: providers } });
  const byProvider = new Map(records.map((record) => [record.provider, record]));
  return seoProviderSettingsResponseSchema.parse({ providers: await Promise.all(providers.map(async (provider) => {
    const record = byProvider.get(provider);
    const credentials = record === undefined
      ? environmentProviderCredentials(provider, config)
      : decryptCredentials(record.credentialsEncrypted, config);
    return toDto(record, provider, credentials);
  })) });
}

export async function saveSeoProviderSettings(input: SeoProviderSettingsUpdate, config: AppConfig): Promise<SeoProviderSettings> {
  const parsed = seoProviderSettingsUpdateSchema.parse(input);
  const existing = await SeoProviderSettingModel.findOne({ provider: parsed.provider });
  const previous = existing === null ? emptyCredentials : decryptCredentials(existing.credentialsEncrypted, config);
  const merged: SeoProviderCredentials = { ...previous, ...Object.fromEntries(Object.entries(parsed.credentials).filter(([, value]) => value !== undefined && value !== "")) };
  const configured = hasCredentials(merged);
  const record = existing ?? new SeoProviderSettingModel({ provider: parsed.provider });
  record.enabled = parsed.enabled;
  record.configured = configured;
  record.credentialsEncrypted = encryptCredentials(merged, config);
  const hint = credentialHint(parsed.provider, merged);
  if (hint === undefined) delete record.credentialHint;
  else record.credentialHint = hint;
  record.status = configured ? "configured" : "not-configured";
  record.message = configured ? defaultMessage(parsed.provider) : "No credentials configured.";
  delete record.lastCheckedAt;
  await record.save();
  return toDto(record, parsed.provider, merged);
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

async function googleConnection(credentials: SeoProviderCredentials): Promise<string> {
  if (!credentials.site || !credentials.clientEmail || !credentials.privateKey) throw new Error("Google requires a Search Console site, service-account email, and private key.");
  const now = Math.floor(Date.now() / 1_000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: credentials.clientEmail, scope: "https://www.googleapis.com/auth/webmasters.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3_600 }));
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(credentials.privateKey.replace(/\\n/g, "\n"), "base64url");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(8_000) });
  const tokenPayload = asRecord(await tokenResponse.json().catch(() => undefined));
  const accessToken = tokenPayload.access_token;
  if (!tokenResponse.ok || typeof accessToken !== "string") throw new Error("Google authorization failed.");
  const sitesResponse = await fetch("https://www.googleapis.com/webmasters/v3/sites", { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!sitesResponse.ok) throw new Error(`Google Search Console returned HTTP ${sitesResponse.status}.`);
  const sites = asRecord(await sitesResponse.json().catch(() => undefined)).siteEntry;
  if (!Array.isArray(sites) || !sites.some((entry) => asRecord(entry).siteUrl === credentials.site)) throw new Error("The Google service account does not have access to this Search Console property.");
  return "Google Search Console connection verified.";
}

async function bingConnection(credentials: SeoProviderCredentials): Promise<string> {
  if (!credentials.apiKey) throw new Error("Bing requires a Webmaster API key.");
  const endpoint = new URL("https://ssl.bing.com/webmaster/api.svc/json/GetUserSites");
  endpoint.searchParams.set("apikey", credentials.apiKey);
  const response = await fetch(endpoint, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Bing Webmaster returned HTTP ${response.status}.`);
  return "Bing Webmaster connection verified.";
}

async function yandexConnection(credentials: SeoProviderCredentials): Promise<string> {
  if (!credentials.token) throw new Error("Yandex requires an OAuth token.");
  const response = await fetch("https://api.webmaster.yandex.net/v4/user", { headers: { Authorization: `OAuth ${credentials.token}`, Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Yandex Webmaster returned HTTP ${response.status}.`);
  return "Yandex Webmaster connection verified.";
}

async function indexNowConnection(credentials: SeoProviderCredentials, config: AppConfig): Promise<string> {
  if (!credentials.key) throw new Error("IndexNow requires a key.");
  if (!credentials.keyLocation) return "IndexNow key saved. Add a key location to verify the hosted key file.";
  const keyLocation = new URL(credentials.keyLocation);
  if (keyLocation.protocol !== "http:" && keyLocation.protocol !== "https:") throw new Error("IndexNow key location must use HTTP or HTTPS.");
  if (keyLocation.origin !== new URL(config.frontendOrigin).origin) throw new Error("IndexNow key location must use the configured public site origin.");
  const response = await fetch(keyLocation, { headers: { Accept: "text/plain" }, signal: AbortSignal.timeout(8_000) });
  const body = (await response.text()).trim();
  if (!response.ok || body !== credentials.key) throw new Error("The IndexNow key location did not return the configured key.");
  return "IndexNow key file verified.";
}

export async function testSeoProviderConnection(input: { provider: SeoConnectionProvider }, config: AppConfig): Promise<SeoProviderSettings> {
  const parsed = seoProviderTestRequestSchema.parse(input);
  const record = await SeoProviderSettingModel.findOne({ provider: parsed.provider });
  const credentials = record === null
    ? environmentProviderCredentials(parsed.provider, config)
    : decryptCredentials(record.credentialsEncrypted, config);
  if (!hasCredentials(credentials)) return toDto(record ?? undefined, parsed.provider, credentials);
  let status: SeoProviderSettings["status"] = "connected";
  let message = "Connection verified.";
  try {
    if (parsed.provider === "google") message = await googleConnection(credentials);
    else if (parsed.provider === "bing") message = await bingConnection(credentials);
    else if (parsed.provider === "yandex") message = await yandexConnection(credentials);
    else if (parsed.provider === "indexnow") message = await indexNowConnection(credentials, config);
    else {
      status = "unsupported";
      message = await Promise.resolve(defaultMessage("baidu"));
    }
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Connection check failed.";
  }
  if (record === null) return transientDto(parsed.provider, credentials, status, message);
  record.status = status;
  record.message = message;
  record.lastCheckedAt = new Date();
  await record.save();
  return toDto(record, parsed.provider, credentials);
}

export function providerInputSchema(provider: string): SeoConnectionProvider {
  return seoConnectionProviderSchema.parse(provider);
}
