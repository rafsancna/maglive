import {
  seoAuditRequestSchema,
  seoAuditLookupRequestSchema,
  seoAuditSchema,
  seoProviderSyncRequestSchema,
  searchProviderSchema,
  searchMetricSnapshotSchema,
  indexingSubmissionSchema,
  seoScoreRequestSchema,
  seoScoreResponseSchema,
  seoDashboardSummarySchema,
  seoConnectionProviderSchema,
  seoProviderSettingsResponseSchema,
  seoProviderSettingsSchema,
  seoProviderSettingsUpdateSchema,
  seoProviderTestRequestSchema,
} from "@maglive/contracts";
import { Router } from "express";
import type { RequestHandler } from "express";
import { assertValidCsrfToken } from "../../auth/csrf.js";
import type { AppConfig } from "../../config/env.js";
import { createAdminMutationRateLimit } from "../../middleware/rateLimits.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import { calculateSeoScore, seoEngineAvailability } from "../../services/seoScoringService.js";
import { getLatestSeoAudit, runSeoAudit } from "../../services/seoAuditService.js";
import { latestSearchMetrics, syncSearchMetrics } from "../../services/searchPerformanceService.js";
import { listSubmissions, processPendingSubmissions } from "../../services/urlSubmissionService.js";
import { getSeoDashboardSummary } from "../../services/seoDashboardService.js";
import {
  listSeoProviderSettings,
  saveSeoProviderSettings,
  testSeoProviderConnection,
} from "../../services/seoProviderSettingsService.js";
import { parseRequestValue } from "../validation.js";

export function createAdminSeoRouter(
  config: AppConfig,
  now: () => number = Date.now,
): Router {
  const router = Router();
  router.use(createRequireAdmin(config, now));
  const requireCsrf: RequestHandler = (request, _response, next) => {
    try {
      assertValidCsrfToken(request, now());
      next();
    } catch (error) {
      next(error);
    }
  };
  const mutationGuards = [
    requireTrustedOrigin(config.frontendOrigin),
    createAdminMutationRateLimit(config),
    requireCsrf,
  ];

  router.get("/providers", async (_request, response, next) => {
    try {
      response.json({ data: seoProviderSettingsResponseSchema.parse(await listSeoProviderSettings(config)) });
    } catch (error) {
      next(error);
    }
  });

  router.put("/providers/:provider", ...mutationGuards, async (request, response, next) => {
    try {
      const provider = seoConnectionProviderSchema.parse(request.params.provider);
      const body = parseRequestValue(seoProviderSettingsUpdateSchema, { ...request.body, provider }, "body");
      response.json({ data: seoProviderSettingsSchema.parse(await saveSeoProviderSettings(body, config)) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/providers/:provider/test", ...mutationGuards, async (request, response, next) => {
    try {
      const provider = seoConnectionProviderSchema.parse(request.params.provider);
      const body = parseRequestValue(seoProviderTestRequestSchema, { provider }, "body");
      response.json({ data: seoProviderSettingsSchema.parse(await testSeoProviderConnection(body, config)) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/score", ...mutationGuards, (request, response, next) => {
    try {
      const input = parseRequestValue(
        seoScoreRequestSchema,
        request.body,
        "body",
      );
      const score = calculateSeoScore(input);
      const engines = seoEngineAvailability(input);
      response.json({
        data: seoScoreResponseSchema.parse({ score, scores: [score], engines: { internal: true, ...engines } }),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/audits", ...mutationGuards, async (request, response, next) => {
    try {
      const input = parseRequestValue(seoAuditRequestSchema, request.body, "body");
      response.status(201).json({ data: seoAuditSchema.parse(await runSeoAudit(input, config)) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/audits/latest", async (request, response, next) => {
    try {
      const input = parseRequestValue(seoAuditLookupRequestSchema, request.query, "query");
      response.json({ data: await getLatestSeoAudit(input) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/metrics", async (request, response, next) => {
    try {
      const providerResult = typeof request.query.provider === "string" ? searchProviderSchema.safeParse(request.query.provider) : undefined;
      const provider = providerResult?.success === true ? providerResult.data : undefined;
      response.json({ data: (await latestSearchMetrics(provider)).map((item) => searchMetricSnapshotSchema.parse(item)) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/metrics/sync", ...mutationGuards, async (request, response, next) => {
    try {
      const input = parseRequestValue(seoProviderSyncRequestSchema, request.body, "body");
      response.status(201).json({ data: searchMetricSnapshotSchema.parse(await syncSearchMetrics(input, config)) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/submissions", async (_request, response, next) => {
    try {
      response.json({ data: (await listSubmissions()).map((item) => indexingSubmissionSchema.parse(item)) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/submissions/process", ...mutationGuards, async (_request, response, next) => {
    try {
      await processPendingSubmissions(config);
      response.json({ data: { processed: true } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/summary", async (_request, response, next) => {
    try {
      response.json({ data: seoDashboardSummarySchema.parse(await getSeoDashboardSummary()) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
