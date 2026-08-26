import { previewExchangeRequestSchema, previewExchangeResponseSchema, previewProductDtoSchema } from "@maglive/contracts";
import { Router } from "express";
import type { AppConfig } from "../../config/env.js";
import { AppError } from "../../errors/AppError.js";
import { exchangePreviewGrant, readPreviewProduct } from "../../services/previewService.js";
import { parseRequestValue } from "../validation.js";

export function createPreviewRouter(config: AppConfig, now: () => number = Date.now): Router {
  const router = Router();
  router.use((_request, response, next) => { response.setHeader("Cache-Control", "no-store"); next(); });
  router.post("/exchange", async (request, response, next) => {
    try {
      if (request.header("X-Preview-Exchange-Secret") !== config.previewExchangeSecret) throw new AppError(401, "PREVIEW_EXCHANGE_UNAUTHORIZED", "Preview exchange is not authorized.");
      const { grant } = parseRequestValue(previewExchangeRequestSchema, request.body, "body");
      response.json({ data: previewExchangeResponseSchema.parse(await exchangePreviewGrant(grant, config, now())) });
    } catch (error) { next(error); }
  });
  router.get("/products", async (request, response, next) => {
    try {
      const authorization = request.header("Authorization") ?? "";
      if (!authorization.startsWith("Preview ")) throw new AppError(401, "PREVIEW_CREDENTIAL_REQUIRED", "A preview credential is required.");
      const data = previewProductDtoSchema.parse(await readPreviewProduct(authorization.slice(8), config, now()));
      response.json({ data });
    } catch (error) { next(error); }
  });
  return router;
}
