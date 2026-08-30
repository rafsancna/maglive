import { z } from "zod";
import {
  objectIdStringSchema,
  paginationQuerySchema,
} from "./api.js";
import { localeCodeSchema } from "./locale.js";

export const mediaKindSchema = z.enum(["image", "video", "document"]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const mediaStatusSchema = z.enum([
  "processing",
  "ready",
  "failed",
  "deleting",
]);

export const mediaTranslationSchema = z.object({
  title: z.string().trim().min(1).max(240).optional(),
  alt: z.string().trim().min(1).max(240).optional(),
  caption: z.string().trim().min(1).max(1_000).optional(),
});

export const mediaTranslationsSchema = z.partialRecord(
  localeCodeSchema,
  mediaTranslationSchema,
);

export const publicMediaDtoSchema = z.object({
  id: objectIdStringSchema,
  kind: mediaKindSchema,
  url: z.url(),
  mimeType: z.string().min(1).max(160),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type PublicMediaDto = z.infer<typeof publicMediaDtoSchema>;

export const adminMediaDtoSchema = publicMediaDtoSchema.extend({
  originalName: z.string().min(1).max(255),
  sizeBytes: z.number().int().nonnegative(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  durationSeconds: z.number().nonnegative().optional(),
  posterMediaId: objectIdStringSchema.optional(),
  defaultTranslations: mediaTranslationsSchema,
  status: mediaStatusSchema,
  uploadedBy: objectIdStringSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().min(0),
});
export type AdminMediaDto = z.infer<typeof adminMediaDtoSchema>;

export const mediaListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  kind: mediaKindSchema.optional(),
  status: mediaStatusSchema.optional(),
});

export const mediaListDtoSchema = z.object({
  items: z.array(adminMediaDtoSchema),
  pagination: z.object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export type MediaListDto = z.infer<typeof mediaListDtoSchema>;

export const updateMediaRequestSchema = z
  .object({
    version: z.number().int().min(0),
    defaultTranslations: mediaTranslationsSchema.optional(),
    posterMediaId: objectIdStringSchema.nullable().optional(),
  })
  .refine(
    ({ version: _version, ...changes }) =>
      Object.values(changes).some((value) => value !== undefined),
    { message: "At least one media field must be updated." },
  );
export type UpdateMediaRequest = z.infer<typeof updateMediaRequestSchema>;

export const mediaUsageKindSchema = z.enum([
  "navigation-image",
  "category-working-image",
  "category-working-seo",
  "category-published-image",
  "category-published-seo",
  "product-working-media",
  "product-working-seo",
  "product-working-feature-icon",
  "product-published-media",
  "product-published-seo",
  "product-published-feature-icon",
  "media-poster",
]);

export const mediaUsageOwnerTypeSchema = z.enum([
  "product",
  "category",
  "news",
  "story",
  "blog",
  "page",
  "media",
  "other",
]);
export type MediaUsageOwnerType = z.infer<typeof mediaUsageOwnerTypeSchema>;

export const mediaUsageDtoSchema = z.object({
  kind: mediaUsageKindSchema,
  ownerType: mediaUsageOwnerTypeSchema.optional(),
  ownerId: objectIdStringSchema,
  ownerLabel: z.string().min(1).max(255),
  placement: z.string().min(1).max(120).optional(),
  path: z.string().min(1).max(255),
  locale: localeCodeSchema.optional(),
});
export type MediaUsageDto = z.infer<typeof mediaUsageDtoSchema>;

export const mediaUsagesDtoSchema = z.object({
  usages: z.array(mediaUsageDtoSchema),
});
export type MediaUsagesDto = z.infer<typeof mediaUsagesDtoSchema>;

export const mediaDeletedDtoSchema = z.object({
  deleted: z.literal(true),
});
