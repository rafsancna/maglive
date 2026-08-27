import { z } from "zod";

import { objectIdStringSchema } from "./api.js";
import { localeCodeSchema } from "./locale.js";

export const categorySlugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => slug !== "products", {
    message: 'The slug "products" is reserved.',
  });

export function createCategorySlugBase(categoryName: string): string {
  const slug = categoryName
    .replace(/\p{S}/gu, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
  return slug === "products" ? "products-category" : slug;
}

export const categorySeoInputSchema = z.object({
  title: z.string().trim().min(1).max(70).optional(),
  description: z.string().trim().min(1).max(320).optional(),
  openGraphMediaId: objectIdStringSchema.optional(),
});

export const categoryTranslationInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).optional(),
  seo: categorySeoInputSchema.default({}),
});

export const categoryImageTranslationInputSchema = z.object({
  alt: z.string().trim().min(1).max(240).optional(),
  title: z.string().trim().min(1).max(240).optional(),
});

export const categoryImageUsageInputSchema = z.object({
  mediaId: objectIdStringSchema,
  translations: z
    .partialRecord(localeCodeSchema, categoryImageTranslationInputSchema)
    .default({}),
});

export const categoryTranslationsInputSchema = z.partialRecord(
  localeCodeSchema,
  categoryTranslationInputSchema,
);

export const categoryStatusSchema = z.enum(["active", "archived", "deleting"]);

export const publishedCategoryGlobalDataSchema = z.object({
  slug: categorySlugSchema,
  parentId: objectIdStringSchema.nullable(),
  sortOrder: z.number().int().min(0),
  imageMediaId: objectIdStringSchema.optional(),
});

export const publishedCategoryLocaleDataSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2_000).optional(),
  seo: z.object({
    title: z.string().min(1).max(70),
    description: z.string().max(320).optional(),
    openGraphMediaId: objectIdStringSchema.optional(),
  }),
  image: z
    .object({
      alt: z.string().min(1).max(240),
      title: z.string().max(240).optional(),
    })
    .optional(),
});

const sourceHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const revisionSchema = z.uuid();
const dateTimeSchema = z.iso.datetime();

export const publishedCategoryGlobalSchema = z.object({
  sourceVersion: z.number().int().min(0),
  sourceHash: sourceHashSchema,
  globalRevision: revisionSchema,
  publishedAt: dateTimeSchema,
  data: publishedCategoryGlobalDataSchema,
});

export const publishedCategoryLocaleSchema = z.object({
  sourceVersion: z.number().int().min(0),
  sourceHash: sourceHashSchema,
  globalRevision: revisionSchema,
  publicationRevision: revisionSchema,
  publishedAt: dateTimeSchema,
  data: publishedCategoryLocaleDataSchema,
});

export const categoryLocaleStateSchema = z.enum([
  "incomplete",
  "draft",
  "published",
  "changes-pending",
]);

export const categoryAdminDtoSchema = z.object({
  id: objectIdStringSchema,
  slug: categorySlugSchema,
  parentId: objectIdStringSchema.nullable(),
  sortOrder: z.number().int().min(0),
  translations: categoryTranslationsInputSchema,
  image: categoryImageUsageInputSchema.optional(),
  status: categoryStatusSchema,
  publishedGlobal: publishedCategoryGlobalSchema.optional(),
  publishedSnapshots: z.partialRecord(
    localeCodeSchema,
    publishedCategoryLocaleSchema,
  ),
  workingGlobalHash: sourceHashSchema,
  workingLocaleHashes: z.partialRecord(localeCodeSchema, sourceHashSchema),
  localeStates: z.record(localeCodeSchema, categoryLocaleStateSchema),
  firstPublishedAt: dateTimeSchema.optional(),
  createdBy: objectIdStringSchema,
  updatedBy: objectIdStringSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  version: z.number().int().min(0),
});

export const categoryListDtoSchema = z.object({
  categories: z.array(categoryAdminDtoSchema),
});

export const publicCategorySeoSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  openGraphMediaId: objectIdStringSchema.optional(),
});

export const publicCategoryDtoSchema = z.object({
  id: objectIdStringSchema,
  slug: categorySlugSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  parentId: objectIdStringSchema.nullable(),
  sortOrder: z.number().int().min(0),
  seo: publicCategorySeoSchema,
  image: z
    .object({
      mediaId: objectIdStringSchema,
      alt: z.string().min(1),
      title: z.string().optional(),
    })
    .optional(),
  availableLocales: z.array(localeCodeSchema).min(1),
  breadcrumbs: z.array(
    z.object({
      slug: categorySlugSchema,
      name: z.string().min(1),
    }),
  ),
});

export type PublicCategoryTreeNode = z.infer<typeof publicCategoryDtoSchema> & {
  children: PublicCategoryTreeNode[];
};

export const publicCategoryTreeNodeSchema: z.ZodType<PublicCategoryTreeNode> =
  publicCategoryDtoSchema.extend({
    children: z.lazy(() => z.array(publicCategoryTreeNodeSchema)),
  });

export const publicCategoryTreeDtoSchema = z.object({
  categories: z.array(publicCategoryTreeNodeSchema),
});

export const createCategoryRequestSchema = z.object({
  slug: categorySlugSchema,
  parentId: objectIdStringSchema.nullable().default(null),
  sortOrder: z.number().int().min(0).default(0),
  translations: categoryTranslationsInputSchema.default({}),
  image: categoryImageUsageInputSchema.optional(),
});

export const updateCategoryRequestSchema = z
  .object({
    version: z.number().int().min(0),
    slug: categorySlugSchema.optional(),
    parentId: objectIdStringSchema.nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
    translations: categoryTranslationsInputSchema.optional(),
    image: categoryImageUsageInputSchema.nullable().optional(),
  })
  .refine(
    ({ version: _version, ...changes }) =>
      Object.values(changes).some((value) => value !== undefined),
    { message: "At least one category field must be updated." },
  );

export const reorderCategoryItemSchema = z.object({
  id: objectIdStringSchema,
  version: z.number().int().min(0),
});

export const reorderCategoriesRequestSchema = z.object({
  parentId: objectIdStringSchema.nullable(),
  categories: z.array(reorderCategoryItemSchema).min(1),
});

export const publishCategoryRequestSchema = z.object({
  version: z.number().int().min(0),
  locales: z.array(localeCodeSchema).min(1),
  promoteShared: z.boolean().default(false),
});

export const unpublishCategoryRequestSchema = z.object({
  version: z.number().int().min(0),
  locale: localeCodeSchema.optional(),
});

export const categoryVersionRequestSchema = z.object({
  version: z.number().int().min(0),
});

export const categoryDeletedDtoSchema = z.object({
  deleted: z.literal(true),
});

export const publicCategoryQuerySchema = z.object({
  locale: localeCodeSchema,
});

export type CategoryAdminDto = z.infer<typeof categoryAdminDtoSchema>;
export type CategoryListDto = z.infer<typeof categoryListDtoSchema>;
export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>;
export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>;
export type ReorderCategoriesRequest = z.infer<
  typeof reorderCategoriesRequestSchema
>;
export type PublishCategoryRequest = z.infer<typeof publishCategoryRequestSchema>;
export type UnpublishCategoryRequest = z.infer<
  typeof unpublishCategoryRequestSchema
>;
export type PublicCategoryDto = z.infer<typeof publicCategoryDtoSchema>;
export type PublicCategoryTreeDto = z.infer<typeof publicCategoryTreeDtoSchema>;
