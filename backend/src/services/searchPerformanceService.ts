import { createSign } from "node:crypto";
import {
  seoProviderSyncRequestSchema,
  type SearchMetricSnapshot,
  type SearchProvider,
  type SeoProviderCredentials,
  type SeoProviderSyncRequest,
} from "@maglive/contracts";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { effectiveProviderCredentials } from "./seoProviderSettingsService.js";
import {
  SearchMetricSnapshotModel,
  toSearchMetricDto,
} from "../models/SearchMetricSnapshot.js";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null ? value as JsonRecord : {};
}

function base64Url(value: string): string {
  return Buffer.from(value).toString("base64url");
}

async function googleAccessToken(_config: AppConfig, credentials: SeoProviderCredentials): Promise<string> {
  if (credentials.clientEmail === undefined || credentials.privateKey === undefined) {
    throw new AppError(503, "SEARCH_PROVIDER_UNAVAILABLE", "Google Search Console credentials are not configured.");
  }
  const now = Math.floor(Date.now() / 1_000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: credentials.clientEmail,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3_600,
  }));
  const unsigned = `${header}.${payload}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(credentials.privateKey.replace(/\\n/g, "\n"), "base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(8_000),
  });
  const body: unknown = await response.json().catch(() => undefined);
  const token = asRecord(body).access_token;
  if (!response.ok || typeof token !== "string") throw new AppError(503, "SEARCH_PROVIDER_UNAVAILABLE", "Google authorization failed.");
  return token;
}

function metricNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function googleMetrics(input: SeoProviderSyncRequest, config: AppConfig): Promise<SearchMetricSnapshot> {
  const site = config.googleSearchConsoleSite;
  const credentials = await effectiveProviderCredentials("google", config);
  const effectiveSite = credentials.site ?? site;
  if (effectiveSite === undefined) throw new AppError(503, "SEARCH_PROVIDER_UNAVAILABLE", "Google Search Console site is not configured.");
  const token = await googleAccessToken(config, credentials);
  const analyticsUrl = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(effectiveSite)}/searchAnalytics/query`;
  const body: JsonRecord = { startDate: input.startDate, endDate: input.endDate, dimensions: ["page"], rowLimit: 1_000 };
  if (input.entityUrl !== undefined) body.dimensionFilterGroups = [{ filters: [{ dimension: "page", expression: input.entityUrl, operator: "equals" }] }];
  const response = await fetch(analyticsUrl, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(12_000) });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new AppError(503, "SEARCH_PROVIDER_UNAVAILABLE", "Google Search Console metrics could not be loaded.");
  const rawRows = asRecord(payload).rows;
  const rows: JsonRecord[] = Array.isArray(rawRows) ? rawRows.map((row: unknown) => asRecord(row)) : [];
  const clicks = rows.reduce((sum, row) => sum + (metricNumber(row.clicks) ?? 0), 0);
  const impressions = rows.reduce((sum, row) => sum + (metricNumber(row.impressions) ?? 0), 0);
  const weightedPosition = rows.reduce((sum, row) => sum + (metricNumber(row.position) ?? 0) * (metricNumber(row.impressions) ?? 0), 0);
  const inspectionResponse = input.entityUrl === undefined ? undefined : await fetch("https://searchconsole.googleapis.com/v1/urlInspection/index:inspect", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ inspectionUrl: input.entityUrl, siteUrl: effectiveSite }), signal: AbortSignal.timeout(12_000) });
  const inspection: JsonRecord = inspectionResponse === undefined ? {} : asRecord(await inspectionResponse.json().catch(() => undefined));
  const indexStatus = asRecord(asRecord(inspection.inspectionResult).indexStatusResult);
  const indexed = typeof indexStatus.verdict === "string" ? indexStatus.verdict === "PASS" : undefined;
  const crawl = typeof indexStatus.lastCrawlTime === "string" ? indexStatus.lastCrawlTime : undefined;
  const fetchedAt = new Date();
  return {
    id: "000000000000000000000000",
    provider: "google",
    site: effectiveSite,
    ...(input.entityUrl === undefined ? {} : { entityUrl: input.entityUrl }),
    startDate: input.startDate,
    endDate: input.endDate,
    ...(rows.length === 0 ? {} : { clicks, impressions, ctr: impressions === 0 ? 0 : clicks / impressions, ...(impressions === 0 ? {} : { position: weightedPosition / impressions }) } ),
    ...(indexed === undefined ? {} : { indexed }),
    ...(crawl === undefined ? {} : { crawlLastCrawled: crawl }),
    queryCount: rows.length,
    fetchedAt: fetchedAt.toISOString(),
  };
}

async function bingMetrics(input: SeoProviderSyncRequest, config: AppConfig): Promise<SearchMetricSnapshot> {
  const credentials = await effectiveProviderCredentials("bing", config);
  if (credentials.apiKey === undefined) throw new AppError(503, "SEARCH_PROVIDER_UNAVAILABLE", "Bing Webmaster credentials are not configured.");
  const site = credentials.site ?? config.frontendOrigin;
  const endpoint = new URL("https://ssl.bing.com/webmaster/api.svc/json/GetRankAndTrafficStats");
  endpoint.searchParams.set("siteUrl", site);
  endpoint.searchParams.set("apikey", credentials.apiKey);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(12_000), headers: { Accept: "application/json" } });
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) throw new AppError(503, "SEARCH_PROVIDER_UNAVAILABLE", "Bing Webmaster metrics could not be loaded.");
  const rawRows = Array.isArray(payload) ? payload : asRecord(payload).d;
  const rows: JsonRecord[] = Array.isArray(rawRows) ? rawRows.map((row: unknown) => asRecord(row)) : [];
  const clicks = rows.reduce((sum, row) => sum + (metricNumber(row.Clicks) ?? metricNumber(row.clicks) ?? 0), 0);
  const impressions = rows.reduce((sum, row) => sum + (metricNumber(row.Impressions) ?? metricNumber(row.impressions) ?? 0), 0);
  return { id: "000000000000000000000000", provider: "bing", site, ...(input.entityUrl === undefined ? {} : { entityUrl: input.entityUrl }), startDate: input.startDate, endDate: input.endDate, ...(rows.length === 0 ? {} : { clicks, impressions, ctr: impressions === 0 ? 0 : clicks / impressions }), queryCount: rows.length, fetchedAt: new Date().toISOString() };
}

export async function syncSearchMetrics(input: SeoProviderSyncRequest, config: AppConfig): Promise<SearchMetricSnapshot> {
  const parsed = seoProviderSyncRequestSchema.parse(input);
  const metric = parsed.provider === "google" ? await googleMetrics(parsed, config) : parsed.provider === "bing" ? await bingMetrics(parsed, config) : (() => { throw new AppError(503, "SEARCH_PROVIDER_UNAVAILABLE", `${parsed.provider} performance metrics are not configured.`); })();
  const { id: _id, crawlLastCrawled, fetchedAt, ...rest } = metric;
  void _id;
  const saved = await SearchMetricSnapshotModel.create({ ...rest, ...(crawlLastCrawled === undefined ? {} : { crawlLastCrawled: new Date(crawlLastCrawled) }), fetchedAt: new Date(fetchedAt) } as never);
  return toSearchMetricDto(saved);
}

export async function latestSearchMetrics(provider?: SearchProvider): Promise<SearchMetricSnapshot[]> {
  const filter = provider === undefined ? {} : { provider };
  const records = await SearchMetricSnapshotModel.find(filter as never).sort({ fetchedAt: -1 }).limit(50);
  return records.map(toSearchMetricDto);
}
