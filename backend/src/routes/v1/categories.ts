import {
  categoryAdminDtoSchema,
  categoryDeletedDtoSchema,
  categoryListDtoSchema,
  categorySlugSchema,
  categoryVersionRequestSchema,
  createCategoryRequestSchema,
  objectIdStringSchema,
  publicCategoryDtoSchema,
  publicCategoryQuerySchema,
  publicCategoryTreeDtoSchema,
  publishCategoryRequestSchema,
  reorderCategoriesRequestSchema,
  type SafeAdminDto,
  unpublishCategoryRequestSchema,
  updateCategoryRequestSchema,
} from "@maglive/contracts";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { assertValidCsrfToken } from "../../auth/csrf.js";
import type { AppConfig } from "../../config/env.js";
import { createAdminMutationRateLimit } from "../../middleware/rateLimits.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  getAdminCategory,
  getPublicCategory,
  getPublicCategoryTree,
  listAdminCategories,
  publishCategory,
  reorderCategories,
  unpublishCategory,
  updateCategory,
} from "../../services/categoryService.js";
import { parseRequestValue } from "../validation.js";

const idParamsSchema = z.object({ id: objectIdStringSchema });
const slugParamsSchema = z.object({ slug: categorySlugSchema });

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

export function createAdminCategoriesRouter(
  config: AppConfig,
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

  router.get("/", async (_request, response, next) => {
    try {
      const data = categoryListDtoSchema.parse(await listAdminCategories());
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", ...mutationGuards, async (request, response, next) => {
    try {
      const input = parseRequestValue(
        createCategoryRequestSchema,
        request.body,
        "body",
      );
      const admin = response.locals.admin as SafeAdminDto;
      const data = categoryAdminDtoSchema.parse(
        await createCategory(input, admin),
      );
      response.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post("/reorder", ...mutationGuards, async (request, response, next) => {
    try {
      const input = parseRequestValue(
        reorderCategoriesRequestSchema,
        request.body,
        "body",
      );
      const admin = response.locals.admin as SafeAdminDto;
      const data = categoryListDtoSchema.parse(
        await reorderCategories(input, admin),
      );
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      const data = categoryAdminDtoSchema.parse(await getAdminCategory(id));
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", ...mutationGuards, async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      const input = parseRequestValue(
        updateCategoryRequestSchema,
        request.body,
        "body",
      );
      const admin = response.locals.admin as SafeAdminDto;
      const data = categoryAdminDtoSchema.parse(
        await updateCategory(id, input, admin),
      );
      response.json({ data });
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
      await deleteCategory(id, version);
      response.json({ data: categoryDeletedDtoSchema.parse({ deleted: true }) });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/publish",
    ...mutationGuards,
    async (request, response, next) => {
      try {
        const { id } = parseRequestValue(
          idParamsSchema,
          request.params,
          "params",
        );
        const input = parseRequestValue(
          publishCategoryRequestSchema,
          request.body,
          "body",
        );
        const admin = response.locals.admin as SafeAdminDto;
        const data = categoryAdminDtoSchema.parse(
          await publishCategory(id, input, admin),
        );
        response.json({ data });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/unpublish",
    ...mutationGuards,
    async (request, response, next) => {
      try {
        const { id } = parseRequestValue(
          idParamsSchema,
          request.params,
          "params",
        );
        const input = parseRequestValue(
          unpublishCategoryRequestSchema,
          request.body,
          "body",
        );
        const admin = response.locals.admin as SafeAdminDto;
        const data = categoryAdminDtoSchema.parse(
          await unpublishCategory(id, input, admin),
        );
        response.json({ data });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/:id/archive",
    ...mutationGuards,
    async (request, response, next) => {
      try {
        const { id } = parseRequestValue(
          idParamsSchema,
          request.params,
          "params",
        );
        const { version } = parseRequestValue(
          categoryVersionRequestSchema,
          request.body,
          "body",
        );
        const admin = response.locals.admin as SafeAdminDto;
        const data = categoryAdminDtoSchema.parse(
          await archiveCategory(id, version, admin),
        );
        response.json({ data });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

export function createPublicCategoriesRouter(): Router {
  const router = Router();

  router.get("/", async (request, response, next) => {
    try {
      const { locale } = parseRequestValue(
        publicCategoryQuerySchema,
        request.query,
        "query",
      );
      const data = publicCategoryTreeDtoSchema.parse(
        await getPublicCategoryTree(locale),
      );
      response.setHeader("Cache-Control", "no-store");
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:slug", async (request, response, next) => {
    try {
      const { slug } = parseRequestValue(
        slugParamsSchema,
        request.params,
        "params",
      );
      const { locale } = parseRequestValue(
        publicCategoryQuerySchema,
        request.query,
        "query",
      );
      const data = publicCategoryDtoSchema.parse(
        await getPublicCategory(slug, locale),
      );
      response.setHeader("Cache-Control", "no-store");
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
