import {
  adminMediaDtoSchema,
  categoryVersionRequestSchema,
  mediaDeletedDtoSchema,
  mediaListDtoSchema,
  mediaListQuerySchema,
  mediaUsagesDtoSchema,
  objectIdStringSchema,
  type SafeAdminDto,
  updateMediaRequestSchema,
} from "@maglive/contracts";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { assertValidCsrfToken } from "../../auth/csrf.js";
import type { AppConfig } from "../../config/env.js";
import { createAdminMutationRateLimit } from "../../middleware/rateLimits.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import {
  deleteMedia,
  getMedia,
  getMediaUsages,
  listMedia,
  updateMedia,
  uploadMedia,
} from "../../services/mediaService.js";
import type { StorageProvider } from "../../storage/StorageProvider.js";
import { parseRequestValue } from "../validation.js";

const idParamsSchema = z.object({ id: objectIdStringSchema });

function requireCsrf(now: () => number): RequestHandler {
  return (request, _response, next) => {
    try {
      assertValidCsrfToken(request, now());
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createAdminMediaRouter(
  config: AppConfig,
  storageProvider: StorageProvider,
  now: () => number = Date.now,
): Router {
  const router = Router();
  const requireAdmin = createRequireAdmin(config, now);
  const mutationGuards = [
    requireTrustedOrigin(config.frontendOrigin),
    createAdminMutationRateLimit(config),
    requireCsrf(now),
  ];

  router.use(requireAdmin);

  router.get("/", async (request, response, next) => {
    try {
      const query = parseRequestValue(
        mediaListQuerySchema,
        request.query,
        "query",
      );
      response.json({
        data: mediaListDtoSchema.parse(await listMedia(query, storageProvider)),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", ...mutationGuards, async (request, response, next) => {
    try {
      const admin = response.locals.admin as SafeAdminDto;
      const data = adminMediaDtoSchema.parse(
        await uploadMedia(request, admin, config, storageProvider),
      );
      response.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/usages", async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      response.json({
        data: mediaUsagesDtoSchema.parse(await getMediaUsages(id)),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      response.json({
        data: adminMediaDtoSchema.parse(await getMedia(id, storageProvider)),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", ...mutationGuards, async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      const input = parseRequestValue(
        updateMediaRequestSchema,
        request.body,
        "body",
      );
      response.json({
        data: adminMediaDtoSchema.parse(
          await updateMedia(id, input, storageProvider),
        ),
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:id", ...mutationGuards, async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      const { version } = parseRequestValue(
        categoryVersionRequestSchema,
        request.body,
        "body",
      );
      await deleteMedia(id, version, storageProvider);
      response.json({ data: mediaDeletedDtoSchema.parse({ deleted: true }) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
