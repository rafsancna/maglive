import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isLocaleCode, previewExchangeResponseSchema, type LocaleCode, type PreviewExchangeResponse } from "@maglive/contracts";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { PreviewGrantModel } from "../models/PreviewGrant.js";
import { ProductModel, toProductAdminDto } from "../models/Product.js";
import { requireLanguage } from "./languageService.js";

const TTL_MS = 5 * 60 * 1_000;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export async function issuePreviewGrant(productId: string, locale: LocaleCode, administratorId: string, config: AppConfig): Promise<{ previewUrl: string; expiresAt: string }> {
  await requireLanguage(locale);
  const product = await ProductModel.findOne({ _id: productId, status: { $nin: ["archived", "deleting"] } });
  if (product === null || !product.slug) throw new AppError(404, "PRODUCT_NOT_FOUND", "The product was not found.");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MS);
  await PreviewGrantModel.create({ tokenHash: hashToken(token), productId: product._id, locale, administratorId, workingVersion: product.version, expiresAt });
  const previewUrl = `${config.frontendOrigin}/api/internal/preview?grant=${encodeURIComponent(token)}`;
  return { previewUrl, expiresAt: expiresAt.toISOString() };
}

export async function exchangePreviewGrant(grant: string, config: AppConfig, now = Date.now()): Promise<PreviewExchangeResponse> {
  const tokenHash = hashToken(grant);
  const record = await PreviewGrantModel.findOneAndUpdate({ tokenHash, consumedAt: { $exists: false }, expiresAt: { $gt: new Date(now) } }, { $set: { consumedAt: new Date(now) } }, { new: true });
  if (record === null) throw new AppError(401, "PREVIEW_GRANT_INVALID", "The preview grant is invalid or expired.");
  const product = await ProductModel.findOne({ _id: record.productId, version: record.workingVersion, status: { $nin: ["archived", "deleting"] } });
  if (product === null) throw new AppError(409, "PREVIEW_VERSION_STALE", "The saved Product changed; create a new preview.");
  const exp = Math.floor((now + TTL_MS) / 1_000);
  const payload = Buffer.from(JSON.stringify({ purpose: "product-preview", productId: product._id.toString(), locale: record.locale, version: product.version, exp })).toString("base64url");
  const accessCredential = `${payload}.${sign(payload, config.previewSigningSecret)}`;
  return previewExchangeResponseSchema.parse({ accessCredential, productId: product._id.toString(), locale: record.locale, slug: product.slug, expiresAt: new Date(exp * 1_000).toISOString() });
}

function verifyCredential(credential: string, config: AppConfig, now = Date.now()): { productId: string; locale: LocaleCode; version: number } {
  const [encoded, signature] = credential.split(".");
  if (!encoded || !signature) throw new AppError(401, "PREVIEW_CREDENTIAL_INVALID", "The preview credential is invalid.");
  const expected = sign(encoded, config.previewSigningSecret);
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError(401, "PREVIEW_CREDENTIAL_INVALID", "The preview credential is invalid.");
  let claims: unknown;
  try { claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown; } catch { throw new AppError(401, "PREVIEW_CREDENTIAL_INVALID", "The preview credential is invalid."); }
  if (typeof claims !== "object" || claims === null) throw new AppError(401, "PREVIEW_CREDENTIAL_INVALID", "The preview credential is invalid.");
  const value = claims as { purpose?: string; productId?: string; locale?: LocaleCode; version?: number; exp?: number };
  if (value.purpose !== "product-preview" || typeof value.productId !== "string" || typeof value.locale !== "string" || !isLocaleCode(value.locale) || typeof value.version !== "number" || typeof value.exp !== "number" || value.exp * 1_000 <= now) throw new AppError(401, "PREVIEW_CREDENTIAL_INVALID", "The preview credential is invalid or expired.");
  return { productId: value.productId, locale: value.locale, version: value.version };
}

export async function readPreviewProduct(credential: string, config: AppConfig, now = Date.now()) {
  const claims = verifyCredential(credential, config, now);
  await requireLanguage(claims.locale);
  const product = await ProductModel.findOne({ _id: claims.productId, version: claims.version, status: { $nin: ["archived", "deleting"] } });
  if (product === null) throw new AppError(404, "PREVIEW_NOT_FOUND", "The preview is no longer available.");
  const dto = toProductAdminDto(product);
  return { id: dto.id, version: dto.version, slug: dto.slug, categoryId: dto.categoryId, ...(dto.model === undefined ? {} : { model: dto.model }), ...(dto.series === undefined ? {} : { series: dto.series }), translations: dto.translations, specifications: dto.specifications, mediaUsages: dto.mediaUsages, pageTemplate: dto.pageTemplate, displayOrder: dto.displayOrder, featured: dto.featured };
}
