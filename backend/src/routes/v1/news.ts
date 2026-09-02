import {
  adminNewsListDtoSchema, adminNewsListQuerySchema, createNewsRequestSchema, newsAdminDtoSchema,
  newsDeletedDtoSchema, newsSlugSchema, newsVersionRequestSchema, objectIdStringSchema,
  publishNewsRequestSchema, publicNewsDetailDtoSchema, publicNewsListDtoSchema, publicNewsListQuerySchema,
  type SafeAdminDto, unpublishNewsRequestSchema, updateNewsRequestSchema,
} from "@maglive/contracts";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { assertValidCsrfToken } from "../../auth/csrf.js";
import type { AppConfig } from "../../config/env.js";
import { createAdminMutationRateLimit } from "../../middleware/rateLimits.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import {
  archiveNews, createNews, deleteNews, getNews, getPublicNews, listNews, listPublicNews,
  publishNews, unpublishNews, updateNews,
} from "../../services/newsService.js";
import { emitRevalidation } from "../../services/revalidationService.js";
import type { StorageProvider } from "../../storage/StorageProvider.js";
import { parseRequestValue } from "../validation.js";

const idParamsSchema = z.object({ id: objectIdStringSchema });
const slugParamsSchema = z.object({ slug: newsSlugSchema });
function csrf(now: () => number): RequestHandler { return (request, _response, next) => { try { assertValidCsrfToken(request, now()); next(); } catch (error) { next(error); } }; }

export function createAdminNewsRouter(config: AppConfig, now: () => number = Date.now): Router {
  const router = Router();
  const guards = [requireTrustedOrigin(config.frontendOrigin), createAdminMutationRateLimit(config), csrf(now)];
  router.use(createRequireAdmin(config, now));
  router.get("/", async (request, response, next) => { try { response.json({ data: adminNewsListDtoSchema.parse(await listNews(parseRequestValue(adminNewsListQuerySchema, request.query, "query"))) }); } catch (error) { next(error); } });
  router.post("/", ...guards, async (request, response, next) => { try { const actor = response.locals.admin as SafeAdminDto; response.status(201).json({ data: newsAdminDtoSchema.parse(await createNews(parseRequestValue(createNewsRequestSchema, request.body, "body"), actor)) }); } catch (error) { next(error); } });
  router.get("/:id", async (request, response, next) => { try { const { id } = parseRequestValue(idParamsSchema, request.params, "params"); response.json({ data: newsAdminDtoSchema.parse(await getNews(id)) }); } catch (error) { next(error); } });
  router.patch("/:id", ...guards, async (request, response, next) => { try { const { id } = parseRequestValue(idParamsSchema, request.params, "params"); const actor = response.locals.admin as SafeAdminDto; const data = newsAdminDtoSchema.parse(await updateNews(id, parseRequestValue(updateNewsRequestSchema, request.body, "body"), actor)); void emitRevalidation(config, { kind: "news", operation: "update", tags: [`news:${id}`, "news", "sitemap"] }); response.json({ data }); } catch (error) { next(error); } });
  router.post("/:id/publish", ...guards, async (request, response, next) => { try { const { id } = parseRequestValue(idParamsSchema, request.params, "params"); const actor = response.locals.admin as SafeAdminDto; const data = newsAdminDtoSchema.parse(await publishNews(id, parseRequestValue(publishNewsRequestSchema, request.body, "body"), actor)); void emitRevalidation(config, { kind: "news", operation: "publish", tags: [`news:${id}`, "news", "sitemap"] }); response.json({ data }); } catch (error) { next(error); } });
  router.post("/:id/unpublish", ...guards, async (request, response, next) => { try { const { id } = parseRequestValue(idParamsSchema, request.params, "params"); const actor = response.locals.admin as SafeAdminDto; const data = newsAdminDtoSchema.parse(await unpublishNews(id, parseRequestValue(unpublishNewsRequestSchema, request.body, "body"), actor)); void emitRevalidation(config, { kind: "news", operation: "unpublish", tags: [`news:${id}`, "news", "sitemap"] }); response.json({ data }); } catch (error) { next(error); } });
  router.post("/:id/archive", ...guards, async (request, response, next) => { try { const { id } = parseRequestValue(idParamsSchema, request.params, "params"); const { version } = parseRequestValue(newsVersionRequestSchema, request.body, "body"); const actor = response.locals.admin as SafeAdminDto; const data = newsAdminDtoSchema.parse(await archiveNews(id, version, actor)); void emitRevalidation(config, { kind: "news", operation: "archive", tags: [`news:${id}`, "news", "sitemap"] }); response.json({ data }); } catch (error) { next(error); } });
  router.delete("/:id", ...guards, async (request, response, next) => { try { const { id } = parseRequestValue(idParamsSchema, request.params, "params"); const { version } = parseRequestValue(newsVersionRequestSchema, request.body, "body"); await deleteNews(id, version); void emitRevalidation(config, { kind: "news", operation: "delete", tags: [`news:${id}`, "news", "sitemap"] }); response.json({ data: newsDeletedDtoSchema.parse({ deleted: true }) }); } catch (error) { next(error); } });
  return router;
}

export function createPublicNewsRouter(storageProvider: StorageProvider): Router {
  const router = Router(); router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/", async (request, response, next) => { try { response.json({ data: publicNewsListDtoSchema.parse(await listPublicNews(parseRequestValue(publicNewsListQuerySchema, request.query, "query"), storageProvider)) }); } catch (error) { next(error); } });
  router.get("/:slug", async (request, response, next) => { try { const { slug } = parseRequestValue(slugParamsSchema, request.params, "params"); const { locale } = parseRequestValue(z.object({ locale: z.string().min(2).max(24) }), request.query, "query"); response.json({ data: publicNewsDetailDtoSchema.parse(await getPublicNews(slug, locale, storageProvider)) }); } catch (error) { next(error); } });
  return router;
}
