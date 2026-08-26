import {
  productSlugSchema,
  publicProductDetailDtoSchema,
  publicProductDetailQuerySchema,
  publicProductListDtoSchema,
  publicProductListQuerySchema,
  publicProductVisibilityDtoSchema,
  publicProductVisibilityQuerySchema,
  publicSitemapEntriesDtoSchema,
  publicSitemapEntriesQuerySchema,
} from "@maglive/contracts";
import { Router } from "express";
import { z } from "zod";
import {
  getPublicProductDetail,
  getPublicProductVisibility,
  listPublicProducts,
  listPublicSitemapEntries,
} from "../../services/publicProductService.js";
import type { StorageProvider } from "../../storage/StorageProvider.js";
import { parseRequestValue } from "../validation.js";

const productSlugParamsSchema = z
  .object({ slug: productSlugSchema })
  .strict();

export function createPublicProductsRouter(
  storageProvider: StorageProvider,
): Router {
  const router = Router();

  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (request, response, next) => {
    try {
      const query = parseRequestValue(
        publicProductListQuerySchema,
        request.query,
        "query",
      );
      const data = publicProductListDtoSchema.parse(
        await listPublicProducts(query, storageProvider),
      );
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:slug/visibility", async (request, response, next) => {
    try {
      const { slug } = parseRequestValue(
        productSlugParamsSchema,
        request.params,
        "params",
      );
      const { locale } = parseRequestValue(
        publicProductVisibilityQuerySchema,
        request.query,
        "query",
      );
      const data = publicProductVisibilityDtoSchema.parse(
        await getPublicProductVisibility(slug, locale),
      );
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:slug", async (request, response, next) => {
    try {
      const { slug } = parseRequestValue(
        productSlugParamsSchema,
        request.params,
        "params",
      );
      const { locale, publicationRevision } = parseRequestValue(
        publicProductDetailQuerySchema,
        request.query,
        "query",
      );
      const data = publicProductDetailDtoSchema.parse(
        await getPublicProductDetail(
          slug,
          locale,
          publicationRevision,
          storageProvider,
        ),
      );
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createPublicSitemapEntriesRouter(): Router {
  const router = Router();

  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });

  router.get("/", async (request, response, next) => {
    try {
      const query = parseRequestValue(
        publicSitemapEntriesQuerySchema,
        request.query,
        "query",
      );
      const data = publicSitemapEntriesDtoSchema.parse(
        await listPublicSitemapEntries(query),
      );
      response.json({ data });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
