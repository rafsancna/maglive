import {
  publicSiteSettingsDtoSchema,
  siteSettingsAdminDtoSchema,
  updateSiteSettingsRequestSchema,
  type SafeAdminDto,
} from "@maglive/contracts";
import { Router, type RequestHandler } from "express";
import { assertValidCsrfToken } from "../../auth/csrf.js";
import type { AppConfig } from "../../config/env.js";
import { createAdminMutationRateLimit } from "../../middleware/rateLimits.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import {
  getAdminSiteSettings,
  getPublicSiteSettings,
  updateAdminSiteSettings,
} from "../../services/siteSettingsService.js";
import type { StorageProvider } from "../../storage/StorageProvider.js";
import { parseRequestValue } from "../validation.js";

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

export function createAdminSiteSettingsRouter(
  config: AppConfig,
  now: () => number = Date.now,
): Router {
  const router = Router();
  router.use(createRequireAdmin(config, now));
  router.get("/", async (_request, response, next) => {
    try {
      response.json({
        data: siteSettingsAdminDtoSchema.parse(await getAdminSiteSettings()),
      });
    } catch (error) {
      next(error);
    }
  });
  router.put(
    "/",
    requireTrustedOrigin(config.frontendOrigin),
    createAdminMutationRateLimit(config),
    requireCsrf(now),
    async (request, response, next) => {
      try {
        const input = parseRequestValue(
          updateSiteSettingsRequestSchema,
          request.body,
          "body",
        );
        const admin = response.locals.admin as SafeAdminDto;
        response.json({
          data: siteSettingsAdminDtoSchema.parse(
            await updateAdminSiteSettings(input, admin),
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}

export function createPublicSiteSettingsRouter(
  storageProvider: StorageProvider,
): Router {
  const router = Router();
  router.get("/", async (_request, response, next) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json({
        data: publicSiteSettingsDtoSchema.parse(
          await getPublicSiteSettings(storageProvider),
        ),
      });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
