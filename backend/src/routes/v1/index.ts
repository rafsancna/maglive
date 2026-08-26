import { Router } from "express";
import type { AppConfig } from "../../config/env.js";
import type { DatabaseHealth } from "../../config/database.js";
import { createAuthRouter } from "./auth.js";
import {
  createAdminCategoriesRouter,
  createPublicCategoriesRouter
} from "./categories.js";
import { createHealthRouter } from "./health.js";
import type { StorageProvider } from "../../storage/StorageProvider.js";
import { createAdminMediaRouter } from "./media.js";
import { createAdminProductsRouter } from "./products.js";
import {
  createPublicProductsRouter,
  createPublicSitemapEntriesRouter
} from "./publicProducts.js";

export function createV1Router(
  getDatabaseHealth: () => DatabaseHealth,
  config: AppConfig,
  now: (() => number) | undefined,
  storageProvider: StorageProvider
): Router {
  const router = Router();
  router.use(createHealthRouter(getDatabaseHealth));
  router.use("/admin", (_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use("/admin/auth", createAuthRouter(now === undefined ? { config } : { config, now }));
  router.use(
    "/admin/categories",
    createAdminCategoriesRouter(config, now ?? Date.now)
  );
  router.use(
    "/admin/media",
    createAdminMediaRouter(config, storageProvider, now ?? Date.now)
  );
  router.use(
    "/admin/products",
    createAdminProductsRouter(config, now ?? Date.now)
  );
  router.use("/public/categories", createPublicCategoriesRouter());
  router.use("/public/products", createPublicProductsRouter(storageProvider));
  router.use(
    "/public/sitemap-entries",
    createPublicSitemapEntriesRouter()
  );
  return router;
}
