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
import { AppError } from "../../errors/AppError.js";
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
  retryMediaProcessing,
} from "../../services/mediaService.js";
import type { StorageProvider } from "../../storage/StorageProvider.js";
import type { MediaJobQueue } from "../../media/mediaQueue.js";
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
  mediaQueue?: MediaJobQueue,
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
        await uploadMedia(request, admin, config, storageProvider, mediaQueue),
      );
      response.status(data.status === "ready" ? 201 : 202).json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/events", async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      response.status(200);
      response.set({
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      response.flushHeaders();
      response.write("retry: 2000\n\n");
      let closed = false;
      let previous = "";
      request.once("close", () => {
        closed = true;
      });
      const send = async (): Promise<void> => {
        if (closed) return;
        try {
          const media = adminMediaDtoSchema.parse(await getMedia(id, storageProvider));
          const serialized = JSON.stringify(media);
          if (serialized !== previous) {
            previous = serialized;
            response.write(`event: media\ndata: ${serialized}\n\n`);
          } else {
            response.write(": heartbeat\n\n");
          }
          if (media.status === "ready" || media.status === "failed") {
            response.end();
            return;
          }
          setTimeout(() => void send(), 1_000).unref();
        } catch {
          response.write(`event: error\ndata: ${JSON.stringify({ message: "Media progress is unavailable." })}\n\n`);
          response.end();
        }
      };
      await send();
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/retry", ...mutationGuards, async (request, response, next) => {
    try {
      if (mediaQueue === undefined) {
        throw new AppError(503, "MEDIA_QUEUE_UNAVAILABLE", "The media processing queue is unavailable.");
      }
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      response.status(202).json({
        data: adminMediaDtoSchema.parse(
          await retryMediaProcessing(id, mediaQueue, storageProvider),
        ),
      });
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
