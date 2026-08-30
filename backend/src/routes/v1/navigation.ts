import {
  navigationAdminDtoSchema,
  navigationDataSchema,
  updateNavigationRequestSchema,
  type SafeAdminDto,
} from "@maglive/contracts";
import { Router, type RequestHandler } from "express";
import { assertValidCsrfToken } from "../../auth/csrf.js";
import type { AppConfig } from "../../config/env.js";
import { createAdminMutationRateLimit } from "../../middleware/rateLimits.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import {
  getAdminNavigation,
  getPublicNavigation,
  updateAdminNavigation,
} from "../../services/navigationService.js";
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

export function createAdminNavigationRouter(
  config: AppConfig,
  now: () => number = Date.now,
): Router {
  const router = Router();
  router.use(createRequireAdmin(config, now));
  router.get("/", async (_request, response, next) => {
    try {
      response.json({ data: navigationAdminDtoSchema.parse(await getAdminNavigation()) });
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
        const input = parseRequestValue(updateNavigationRequestSchema, request.body, "body");
        const admin = response.locals.admin as SafeAdminDto;
        response.json({ data: navigationAdminDtoSchema.parse(await updateAdminNavigation(input, admin)) });
      } catch (error) {
        next(error);
      }
    },
  );
  return router;
}

export function createPublicNavigationRouter(): Router {
  const router = Router();
  router.get("/", async (_request, response, next) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json({ data: navigationDataSchema.parse(await getPublicNavigation()) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
