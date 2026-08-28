import { z } from "zod";

import { localeCodeSchema } from "./locale.js";

export const seoContentTypeSchema = z.enum([
  "product",
  "category",
  "page",
  "news",
  "event",
  "solution",
  "other",
]);

export type SeoContentType = z.infer<typeof seoContentTypeSchema>;

export const seoRobotsSchema = z
  .object({
    index: z.boolean().default(true),
    follow: z.boolean().default(true),
  })
  .strict();

export const seoFieldsSchema = z
  .object({
    focusKeyphrase: z.string().trim().min(1).max(160).optional(),
    title: z.string().trim().min(1).max(70).optional(),
    description: z.string().trim().min(1).max(320).optional(),
    canonicalUrlOverride: z.string().trim().url().max(2_048).optional(),
    robots: seoRobotsSchema.optional(),
    openGraphTitle: z.string().trim().min(1).max(70).optional(),
    openGraphDescription: z.string().trim().min(1).max(320).optional(),
    openGraphMediaId: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
    keywords: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  })
  .strict();

export type SeoFields = z.infer<typeof seoFieldsSchema>;

export const seoImageInputSchema = z
  .object({
    alt: z.string().trim().max(240).optional(),
    src: z.string().url().max(2_048).optional(),
  })
  .strict();

export const seoDocumentInputSchema = z
  .object({
    contentType: seoContentTypeSchema,
    locale: localeCodeSchema,
    title: z.string().max(500).default(""),
    description: z.string().max(2_000).default(""),
    focusKeyphrase: z.string().max(160).default(""),
    slug: z.string().max(320).default(""),
    languageTag: z.string().max(35).optional(),
    content: z.string().max(100_000).default(""),
    headings: z.array(z.string().max(500)).max(500).default([]),
    images: z.array(seoImageInputSchema).max(500).default([]),
    internalLinks: z.number().int().min(0).max(10_000).default(0),
    canonicalUrl: z.string().url().max(2_048).optional(),
    robots: seoRobotsSchema.default({ index: true, follow: true }),
    availableLocales: z.array(localeCodeSchema).max(100).default([]),
    publishedLocales: z.array(localeCodeSchema).max(100).default([]),
    hreflangLocales: z.array(localeCodeSchema).max(100).default([]),
    expectedSchema: z.string().max(80).optional(),
    hasStructuredData: z.boolean().default(false),
  })
  .strict();

export type SeoDocumentInput = z.infer<typeof seoDocumentInputSchema>;

export const seoIssueStatusSchema = z.enum([
  "passed",
  "recommendation",
  "critical",
]);

export const seoIssueSchema = z
  .object({
    key: z.string().min(1).max(120),
    status: seoIssueStatusSchema,
    message: z.string().min(1).max(500),
    points: z.number().int().min(-100).max(100),
    source: z.enum(["internal", "yoast"]).optional(),
  })
  .strict();

export const seoScoreSchema = z
  .object({
    contentType: seoContentTypeSchema,
    locale: localeCodeSchema,
    score: z.number().int().min(0).max(100),
    issues: z.array(seoIssueSchema).max(100),
    calculatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type SeoIssue = z.infer<typeof seoIssueSchema>;
export type SeoScore = z.infer<typeof seoScoreSchema>;

export const seoScoreRequestSchema = seoDocumentInputSchema;
export const seoScoreResponseSchema = z
  .object({
    score: seoScoreSchema,
    scores: z.array(seoScoreSchema).max(100),
    engines: z
      .object({
        internal: z.literal(true),
        yoast: z.boolean(),
        yoastLocaleSupported: z.boolean(),
      })
      .strict(),
  })
  .strict();

export type SeoScoreResponse = z.infer<typeof seoScoreResponseSchema>;

export const seoProviderConnectionStatusSchema = z.enum([
  "not-configured",
  "configured",
  "connected",
  "error",
  "unsupported",
]);

export type SeoProviderConnectionStatus = z.infer<
  typeof seoProviderConnectionStatusSchema
>;

export const seoConnectionProviderSchema = z.enum([
  "google",
  "bing",
  "baidu",
  "yandex",
  "indexnow",
]);

export type SeoConnectionProvider = z.infer<
  typeof seoConnectionProviderSchema
>;

export const seoProviderCredentialsSchema = z
  .object({
    site: z.string().trim().url().max(2_048).optional(),
    apiKey: z.string().trim().min(1).max(500).optional(),
    clientEmail: z.string().trim().email().max(320).optional(),
    privateKey: z.string().min(1).max(10_000).optional(),
    token: z.string().trim().min(1).max(2_000).optional(),
    key: z.string().trim().min(8).max(128).optional(),
    keyLocation: z.string().trim().url().max(2_048).optional(),
  })
  .strict();

export type SeoProviderCredentials = z.infer<
  typeof seoProviderCredentialsSchema
>;

export const seoProviderSettingsSchema = z
  .object({
    provider: seoConnectionProviderSchema,
    site: z.string().url().max(2_048).optional(),
    enabled: z.boolean(),
    configured: z.boolean(),
    status: seoProviderConnectionStatusSchema,
    message: z.string().max(500),
    lastCheckedAt: z.string().datetime({ offset: true }).optional(),
    credentialHint: z.string().max(120).optional(),
  })
  .strict();

export const seoProviderSettingsResponseSchema = z
  .object({
    providers: z.array(seoProviderSettingsSchema).max(10),
  })
  .strict();

export const seoProviderSettingsUpdateSchema = z
  .object({
    provider: seoConnectionProviderSchema,
    enabled: z.boolean().default(true),
    credentials: seoProviderCredentialsSchema,
  })
  .strict();

export const seoProviderTestRequestSchema = z
  .object({ provider: seoConnectionProviderSchema })
  .strict();

export type SeoProviderSettings = z.infer<typeof seoProviderSettingsSchema>;
export type SeoProviderSettingsResponse = z.infer<
  typeof seoProviderSettingsResponseSchema
>;
export type SeoProviderSettingsUpdate = z.infer<
  typeof seoProviderSettingsUpdateSchema
>;

export const seoAuditCheckSchema = z
  .object({
    key: z.string().min(1).max(120),
    status: seoIssueStatusSchema,
    message: z.string().min(1).max(500),
    value: z.string().max(2_048).optional(),
  })
  .strict();

export type SeoAuditCheck = z.infer<typeof seoAuditCheckSchema>;

export const seoAuditSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{24}$/i),
    contentType: seoContentTypeSchema,
    entityId: z.string().regex(/^[a-f0-9]{24}$/i),
    locale: localeCodeSchema,
    url: z.string().url().max(2_048),
    finalUrl: z.string().url().max(2_048).optional(),
    httpStatus: z.number().int().min(100).max(599),
    score: z.number().int().min(0).max(100),
    checks: z.array(seoAuditCheckSchema).max(200),
    brokenLinks: z.array(z.string().url().max(2_048)).max(100),
    error: z.string().max(500).optional(),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const seoAuditRequestSchema = z
  .object({
    contentType: seoContentTypeSchema,
    entityId: z.string().regex(/^[a-f0-9]{24}$/i),
    locale: localeCodeSchema,
  })
  .strict();

export type SeoAuditRequest = z.infer<typeof seoAuditRequestSchema>;

export const seoAuditLookupRequestSchema = seoAuditRequestSchema;
export type SeoAuditLookupRequest = z.infer<typeof seoAuditLookupRequestSchema>;

export const searchProviderSchema = z.enum([
  "google",
  "bing",
  "baidu",
  "yandex",
]);

export type SearchProvider = z.infer<typeof searchProviderSchema>;

export const seoProviderSyncRequestSchema = z
  .object({
    provider: searchProviderSchema,
    startDate: z.string().date(),
    endDate: z.string().date(),
    entityUrl: z.string().url().max(2_048).optional(),
  })
  .strict();

export type SeoProviderSyncRequest = z.infer<typeof seoProviderSyncRequestSchema>;

export const searchMetricSnapshotSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{24}$/i),
    provider: searchProviderSchema,
    site: z.string().url().max(2_048),
    entityUrl: z.string().url().max(2_048).optional(),
    locale: localeCodeSchema.optional(),
    startDate: z.string().date(),
    endDate: z.string().date(),
    clicks: z.number().nonnegative().optional(),
    impressions: z.number().nonnegative().optional(),
    ctr: z.number().min(0).max(1).optional(),
    position: z.number().nonnegative().optional(),
    indexed: z.boolean().optional(),
    crawlLastCrawled: z.string().datetime({ offset: true }).optional(),
    sitemapStatus: z.string().max(120).optional(),
    queryCount: z.number().int().nonnegative().optional(),
    fetchedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const indexingSubmissionSchema = z
  .object({
    id: z.string().regex(/^[a-f0-9]{24}$/i),
    provider: searchProviderSchema,
    url: z.string().url().max(2_048),
    revision: z.string().min(1).max(120),
    status: z.enum(["pending", "submitted", "failed", "skipped"]),
    attempts: z.number().int().nonnegative(),
    lastError: z.string().max(500).optional(),
    submittedAt: z.string().datetime({ offset: true }).optional(),
    nextAttemptAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export const seoDashboardSummarySchema = z
  .object({
    averageScore: z.number().int().min(0).max(100),
    criticalIssues: z.number().int().nonnegative(),
    missingMetaDescriptions: z.number().int().nonnegative(),
    missingAltText: z.number().int().nonnegative(),
    hreflangProblems: z.number().int().nonnegative(),
    schemaProblems: z.number().int().nonnegative(),
    brokenLinks: z.number().int().nonnegative(),
    byContentType: z.partialRecord(seoContentTypeSchema, z.number().int().min(0).max(100)),
    providers: z.partialRecord(searchProviderSchema, z.object({ available: z.boolean(), fetchedAt: z.string().datetime({ offset: true }).optional() }).strict()),
  })
  .strict();

export type SeoAudit = z.infer<typeof seoAuditSchema>;
export type SearchMetricSnapshot = z.infer<typeof searchMetricSnapshotSchema>;
export type IndexingSubmission = z.infer<typeof indexingSubmissionSchema>;
export type SeoDashboardSummary = z.infer<typeof seoDashboardSummarySchema>;
