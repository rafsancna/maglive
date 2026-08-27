import {
  createLanguageRequestSchema,
  languageDtoSchema,
  languageListDtoSchema,
  type SafeAdminDto,
} from "@maglive/contracts";
import { Router, type RequestHandler } from "express";
import { assertValidCsrfToken } from "../../auth/csrf.js";
import type { AppConfig } from "../../config/env.js";
import { createAdminMutationRateLimit } from "../../middleware/rateLimits.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import { createLanguage, listLanguages } from "../../services/languageService.js";
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

export function createAdminLanguagesRouter(
  config: AppConfig,
  now: () => number = Date.now,
): Router {
  const router = Router();
  router.use(createRequireAdmin(config, now));

  router.get("/", async (_request, response, next) => {
    try {
      response.json({ data: languageListDtoSchema.parse(await listLanguages()) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/",
    requireTrustedOrigin(config.frontendOrigin),
    createAdminMutationRateLimit(config),
    requireCsrf(now),
    async (request, response, next) => {
      try {
        const input = parseRequestValue(createLanguageRequestSchema, request.body, "body");
        const admin = response.locals.admin as SafeAdminDto;
        const data = languageDtoSchema.parse(await createLanguage(input, admin));
        response.status(201).json({ data });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export function createPublicLanguagesRouter(): Router {
  const router = Router();
  router.get("/", async (_request, response, next) => {
    try {
      response.setHeader("Cache-Control", "no-store");
      response.json({ data: languageListDtoSchema.parse(await listLanguages()) });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
