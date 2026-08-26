import {
  adminProductListDtoSchema,
  adminProductListQuerySchema,
  createProductRequestSchema,
  duplicateProductRequestSchema,
  objectIdStringSchema,
  productAdminDtoSchema,
  productDeletedDtoSchema,
  productPublicationResultSchema,
  productVersionRequestSchema,
  publishProductRequestSchema,
  type SafeAdminDto,
  unpublishProductRequestSchema,
  updateProductRequestSchema,
} from "@maglive/contracts";
import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { assertValidCsrfToken } from "../../auth/csrf.js";
import type { AppConfig } from "../../config/env.js";
import { createAdminMutationRateLimit } from "../../middleware/rateLimits.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  duplicateProduct,
  getAdminProduct,
  unpublishProduct,
  updateProduct,
} from "../../services/productService.js";
import { listAdminProducts } from "../../services/productQueryService.js";
import { publishProduct } from "../../services/publishingService.js";
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

export function createAdminProductsRouter(
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

  router.get("/", async (request, response, next) => {
    try {
      const query = parseRequestValue(
        adminProductListQuerySchema,
        request.query,
        "query",
      );
      const data = adminProductListDtoSchema.parse(
        await listAdminProducts(query),
      );
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", ...mutationGuards, async (request, response, next) => {
    try {
      const input = parseRequestValue(
        createProductRequestSchema,
        request.body,
        "body",
      );
      const admin = response.locals.admin as SafeAdminDto;
      const data = productAdminDtoSchema.parse(
        await createProduct(input, admin),
      );
      response.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      const data = productAdminDtoSchema.parse(await getAdminProduct(id));
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id", ...mutationGuards, async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      const input = parseRequestValue(
        updateProductRequestSchema,
        request.body,
        "body",
      );
      const admin = response.locals.admin as SafeAdminDto;
      const data = productAdminDtoSchema.parse(
        await updateProduct(id, input, admin),
      );
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/:id/duplicate",
    ...mutationGuards,
    async (request, response, next) => {
      try {
        const { id } = parseRequestValue(
          idParamsSchema,
          request.params,
          "params",
        );
        const input = parseRequestValue(
          duplicateProductRequestSchema,
          request.body,
          "body",
        );
        const admin = response.locals.admin as SafeAdminDto;
        const data = productAdminDtoSchema.parse(
          await duplicateProduct(id, input, admin),
        );
        response.status(201).json({ data });
      } catch (error) {
        next(error);
      }
    },
  );

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
          publishProductRequestSchema,
          request.body,
          "body",
        );
        const admin = response.locals.admin as SafeAdminDto;
        const data = productPublicationResultSchema.parse(
          await publishProduct(id, input, admin),
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
          unpublishProductRequestSchema,
          request.body,
          "body",
        );
        const admin = response.locals.admin as SafeAdminDto;
        const data = productAdminDtoSchema.parse(
          await unpublishProduct(id, input, admin),
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
          productVersionRequestSchema,
          request.body,
          "body",
        );
        const admin = response.locals.admin as SafeAdminDto;
        const data = productAdminDtoSchema.parse(
          await archiveProduct(id, version, admin),
        );
        response.json({ data });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete("/:id", ...mutationGuards, async (request, response, next) => {
    try {
      const { id } = parseRequestValue(idParamsSchema, request.params, "params");
      const { version } = parseRequestValue(
        productVersionRequestSchema,
        request.body,
        "body",
      );
      await deleteProduct(id, version);
      response.json({ data: productDeletedDtoSchema.parse({ deleted: true }) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
