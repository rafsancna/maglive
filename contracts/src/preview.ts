import { z } from "zod";
import { localeCodeSchema } from "./locale.js";
import { objectIdStringSchema } from "./api.js";
import { productSlugSchema } from "./product.js";
import { productWorkingDataSchema } from "./product.js";

export const previewGrantRequestSchema = z.object({
  productId: objectIdStringSchema,
  locale: localeCodeSchema,
}).strict();

export const previewGrantResponseSchema = z.object({
  previewUrl: z.url(),
  expiresAt: z.iso.datetime(),
}).strict();

export const previewExchangeRequestSchema = z.object({ grant: z.string().min(32).max(512) }).strict();

export const previewExchangeResponseSchema = z.object({
  accessCredential: z.string().min(32),
  productId: objectIdStringSchema,
  locale: localeCodeSchema,
  slug: productSlugSchema,
  expiresAt: z.iso.datetime(),
}).strict();

export const previewCredentialClaimsSchema = z.object({
  purpose: z.literal("product-preview"),
  productId: objectIdStringSchema,
  locale: localeCodeSchema,
  version: z.number().int().min(0),
  exp: z.number().int().positive(),
}).strict();

export const previewProductDtoSchema = productWorkingDataSchema.extend({
  id: objectIdStringSchema,
  version: z.number().int().min(0),
}).strict();

export type PreviewGrantRequest = z.infer<typeof previewGrantRequestSchema>;
export type PreviewGrantResponse = z.infer<typeof previewGrantResponseSchema>;
export type PreviewExchangeRequest = z.infer<typeof previewExchangeRequestSchema>;
export type PreviewExchangeResponse = z.infer<typeof previewExchangeResponseSchema>;

export const revalidationEventSchema = z.object({
  eventId: z.uuid(),
  timestamp: z.number().int().positive(),
  kind: z.enum(["product", "category", "media", "news", "sitemap"]),
  operation: z.enum(["publish", "update", "unpublish", "archive", "delete"]),
  tags: z.array(z.string().min(1).max(120)).max(24),
}).strict();
export type RevalidationEvent = z.infer<typeof revalidationEventSchema>;
