import { z } from "zod";

import {
  fieldErrorSchema,
  objectIdStringSchema,
  paginationQuerySchema,
} from "./api.js";
import { categorySlugSchema } from "./category.js";
import { DEFAULT_LOCALE, localeCodeSchema } from "./locale.js";
import { publicMediaDtoSchema } from "./media.js";
import {
  legacyTemplateIdSchema,
  productTemplateIdSchema,
} from "./product-template.js";

export const PRODUCT_LIMITS = Object.freeze({
  contentItemsPerList: 100,
  specificationGroups: 30,
  specificationItemsPerGroup: 100,
  mediaUsages: 300,
  seoKeywords: 20,
  templateDataBytes: 256 * 1024,
  templateDataDepth: 8,
  documentBytes: 8 * 1024 * 1024,
  orderMaximum: 1_000_000,
  name: 200,
  model: 120,
  series: 120,
  shortDescription: 500,
  longDescriptionMarkdown: 50_000,
  contentTitle: 240,
  contentBody: 5_000,
  warrantyInformation: 10_000,
  specificationLabel: 240,
  specificationValue: 500,
  specificationUnit: 40,
  specificationNote: 2_000,
  mediaText: 240,
  mediaCaption: 1_000,
  seoTitle: 70,
  seoDescription: 320,
  seoKeyword: 80,
} as const);

const reservedProductSlugs = new Set([
  "category",
  "new",
  "edit",
  "admin",
  "api",
  "preview",
  "uploads",
]);

export const productSlugSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !reservedProductSlugs.has(slug), {
    message: "The product slug is reserved.",
  });

export function createProductSlugBase(
  productName: string,
): string {
  const nameSegment = productName
    .replace(/\p{S}/gu, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const slug = nameSegment.slice(0, 140).replace(/-+$/g, "");
  return reservedProductSlugs.has(slug) ? `${slug}-product` : slug;
}

export const productNestedKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const productOrderSchema = z
  .number()
  .int()
  .min(0)
  .max(PRODUCT_LIMITS.orderMaximum);

function requireUniqueKeys(
  items: readonly Readonly<{ key: string }>[],
  context: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (seen.has(item.key)) {
      context.addIssue({
        code: "custom",
        message: `The nested key "${item.key}" is duplicated.`,
        path: [index, "key"],
      });
    }
    seen.add(item.key);
  }
}

export const productFeatureSchema = z.object({
  key: productNestedKeySchema,
  title: z.string().trim().min(1).max(PRODUCT_LIMITS.contentTitle),
  body: z.string().trim().max(PRODUCT_LIMITS.contentBody).optional(),
  iconMediaId: objectIdStringSchema.optional(),
}).strict();

export const productTextItemSchema = z.object({
  key: productNestedKeySchema,
  title: z.string().trim().min(1).max(PRODUCT_LIMITS.contentTitle),
  body: z.string().trim().max(PRODUCT_LIMITS.contentBody).optional(),
}).strict();

const productFeatureListSchema = z
  .array(productFeatureSchema)
  .max(PRODUCT_LIMITS.contentItemsPerList)
  .superRefine(requireUniqueKeys);

const productTextItemListSchema = z
  .array(productTextItemSchema)
  .max(PRODUCT_LIMITS.contentItemsPerList)
  .superRefine(requireUniqueKeys);

export const productSeoSchema = z.object({
  focusKeyphrase: z.string().trim().min(1).max(160).optional(),
  title: z.string().trim().min(1).max(PRODUCT_LIMITS.seoTitle).optional(),
  description: z
    .string()
    .trim()
    .min(1)
    .max(PRODUCT_LIMITS.seoDescription)
    .optional(),
  keywords: z
    .array(z.string().trim().min(1).max(PRODUCT_LIMITS.seoKeyword))
    .max(PRODUCT_LIMITS.seoKeywords)
    .optional(),
  openGraphTitle: z
    .string()
    .trim()
    .min(1)
    .max(PRODUCT_LIMITS.seoTitle)
    .optional(),
  openGraphDescription: z
    .string()
    .trim()
    .min(1)
    .max(PRODUCT_LIMITS.seoDescription)
    .optional(),
  openGraphMediaId: objectIdStringSchema.optional(),
  canonicalUrlOverride: z.string().trim().url().max(2_048).optional(),
  robots: z
    .object({ index: z.boolean(), follow: z.boolean() })
    .strict()
    .optional(),
}).strict();

export const productTranslationSchema = z.object({
  name: z.string().trim().min(1).max(PRODUCT_LIMITS.name),
  shortDescription: z
    .string()
    .trim()
    .max(PRODUCT_LIMITS.shortDescription)
    .optional(),
  longDescriptionMarkdown: z
    .string()
    .max(PRODUCT_LIMITS.longDescriptionMarkdown)
    .optional(),
  features: productFeatureListSchema.default([]),
  advantages: productTextItemListSchema.default([]),
  applications: productTextItemListSchema.default([]),
  warrantyInformation: z
    .string()
    .trim()
    .max(PRODUCT_LIMITS.warrantyInformation)
    .optional(),
  seo: productSeoSchema.default({}),
}).strict();

export const productTranslationsSchema = z.partialRecord(
  localeCodeSchema,
  productTranslationSchema,
);

export const specificationGroupTranslationSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(PRODUCT_LIMITS.specificationLabel),
}).strict();

export const specificationItemTranslationSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1)
    .max(PRODUCT_LIMITS.specificationLabel),
  valueOverride: z
    .string()
    .trim()
    .max(PRODUCT_LIMITS.specificationValue)
    .optional(),
  note: z.string().trim().max(PRODUCT_LIMITS.specificationNote).optional(),
}).strict();

export const specificationItemSchema = z.object({
  key: productNestedKeySchema,
  order: productOrderSchema,
  value: z.string().trim().max(PRODUCT_LIMITS.specificationValue),
  unit: z.string().trim().max(PRODUCT_LIMITS.specificationUnit).optional(),
  translations: z
    .partialRecord(localeCodeSchema, specificationItemTranslationSchema)
    .default({}),
}).strict();

export const specificationGroupSchema = z
  .object({
    key: productNestedKeySchema,
    order: productOrderSchema,
    translations: z
      .partialRecord(localeCodeSchema, specificationGroupTranslationSchema)
      .default({}),
    items: z
      .array(specificationItemSchema)
      .max(PRODUCT_LIMITS.specificationItemsPerGroup)
      .superRefine(requireUniqueKeys),
  })
  .strict();

export const productSpecificationsSchema = z
  .array(specificationGroupSchema)
  .max(PRODUCT_LIMITS.specificationGroups)
  .superRefine(requireUniqueKeys);

export const PRODUCT_MEDIA_ROLES = [
  "hero",
  "gallery",
  "video",
  "backgroundVideo",
  "datasheet",
  "certificate",
  "brochure",
  "document",
  "openGraph",
] as const;

export const productMediaRoleSchema = z.enum(PRODUCT_MEDIA_ROLES);
export type ProductMediaRole = z.infer<typeof productMediaRoleSchema>;

export const productMediaTranslationSchema = z.object({
  alt: z.string().trim().min(1).max(PRODUCT_LIMITS.mediaText).optional(),
  title: z.string().trim().min(1).max(PRODUCT_LIMITS.mediaText).optional(),
  caption: z
    .string()
    .trim()
    .min(1)
    .max(PRODUCT_LIMITS.mediaCaption)
    .optional(),
}).strict();

export const productMediaUsageSchema = z.object({
  mediaId: objectIdStringSchema,
  role: productMediaRoleSchema,
  order: productOrderSchema,
  locale: localeCodeSchema.optional(),
  translations: z
    .partialRecord(localeCodeSchema, productMediaTranslationSchema)
    .default({}),
}).strict();

export const productMediaUsagesSchema = z
  .array(productMediaUsageSchema)
  .max(PRODUCT_LIMITS.mediaUsages);

export const productStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
  "deleting",
]);

const publishedProductGlobalSpecificationItemSchema = z
  .object({
    key: productNestedKeySchema,
    order: productOrderSchema,
    value: z.string().max(PRODUCT_LIMITS.specificationValue),
    unit: z.string().max(PRODUCT_LIMITS.specificationUnit).optional(),
  })
  .strict();

export const publishedProductGlobalSpecificationSchema = z
  .object({
    key: productNestedKeySchema,
    order: productOrderSchema,
    items: z
      .array(publishedProductGlobalSpecificationItemSchema)
      .max(PRODUCT_LIMITS.specificationItemsPerGroup)
      .superRefine(requireUniqueKeys),
  })
  .strict();

export const publishedProductGlobalMediaUsageSchema = z.object({
  mediaId: objectIdStringSchema,
  role: productMediaRoleSchema,
  order: productOrderSchema,
  locale: localeCodeSchema.optional(),
}).strict();

export const publishedProductGlobalDataSchema = z
  .object({
    slug: productSlugSchema,
    categoryId: objectIdStringSchema,
    model: z.string().max(PRODUCT_LIMITS.model).optional(),
    series: z.string().max(PRODUCT_LIMITS.series).optional(),
    specifications: z
      .array(publishedProductGlobalSpecificationSchema)
      .max(PRODUCT_LIMITS.specificationGroups)
      .superRefine(requireUniqueKeys),
    mediaUsages: z
      .array(publishedProductGlobalMediaUsageSchema)
      .max(PRODUCT_LIMITS.mediaUsages),
    pageTemplate: productTemplateIdSchema,
    displayOrder: productOrderSchema,
    featured: z.boolean(),
  })
  .strict();

const publishedProductLocaleSpecificationItemSchema = z
  .object({
    key: productNestedKeySchema,
    label: z.string().min(1).max(PRODUCT_LIMITS.specificationLabel),
    valueOverride: z
      .string()
      .max(PRODUCT_LIMITS.specificationValue)
      .optional(),
    note: z.string().max(PRODUCT_LIMITS.specificationNote).optional(),
  })
  .strict();

export const publishedProductLocaleSpecificationSchema = z
  .object({
    key: productNestedKeySchema,
    label: z.string().min(1).max(PRODUCT_LIMITS.specificationLabel),
    items: z
      .array(publishedProductLocaleSpecificationItemSchema)
      .max(PRODUCT_LIMITS.specificationItemsPerGroup)
      .superRefine(requireUniqueKeys),
  })
  .strict();

export const publishedProductLocaleMediaUsageSchema = z.object({
  mediaId: objectIdStringSchema,
  role: productMediaRoleSchema,
  order: productOrderSchema,
  locale: localeCodeSchema.optional(),
  alt: z.string().min(1).max(PRODUCT_LIMITS.mediaText).optional(),
  title: z.string().min(1).max(PRODUCT_LIMITS.mediaText).optional(),
  caption: z.string().min(1).max(PRODUCT_LIMITS.mediaCaption).optional(),
}).strict();

export const publishedProductLocaleDataSchema = z.object({
  name: z.string().min(1).max(PRODUCT_LIMITS.name),
  shortDescription: z
    .string()
    .min(1)
    .max(PRODUCT_LIMITS.shortDescription),
  longDescriptionMarkdown: z
    .string()
    .max(PRODUCT_LIMITS.longDescriptionMarkdown)
    .optional(),
  features: z
    .array(productFeatureSchema)
    .max(PRODUCT_LIMITS.contentItemsPerList)
    .superRefine(requireUniqueKeys),
  advantages: z
    .array(productTextItemSchema)
    .max(PRODUCT_LIMITS.contentItemsPerList)
    .superRefine(requireUniqueKeys),
  applications: z
    .array(productTextItemSchema)
    .max(PRODUCT_LIMITS.contentItemsPerList)
    .superRefine(requireUniqueKeys),
  warrantyInformation: z
    .string()
    .max(PRODUCT_LIMITS.warrantyInformation)
    .optional(),
  seo: z.object({
    focusKeyphrase: z.string().min(1).max(160).optional(),
    title: z.string().min(1).max(PRODUCT_LIMITS.seoTitle),
    description: z.string().max(PRODUCT_LIMITS.seoDescription).optional(),
    keywords: z
      .array(z.string().min(1).max(PRODUCT_LIMITS.seoKeyword))
      .max(PRODUCT_LIMITS.seoKeywords),
    openGraphTitle: z
      .string()
      .min(1)
      .max(PRODUCT_LIMITS.seoTitle)
      .optional(),
    openGraphDescription: z
      .string()
      .max(PRODUCT_LIMITS.seoDescription)
      .optional(),
    openGraphMediaId: objectIdStringSchema.optional(),
    canonicalUrlOverride: z.string().url().max(2_048).optional(),
    robots: z.object({ index: z.boolean(), follow: z.boolean() }).strict().optional(),
  }),
  specifications: z
    .array(publishedProductLocaleSpecificationSchema)
    .max(PRODUCT_LIMITS.specificationGroups)
    .superRefine(requireUniqueKeys),
  mediaUsages: z
    .array(publishedProductLocaleMediaUsageSchema)
    .max(PRODUCT_LIMITS.mediaUsages),
}).strict();

const sourceHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const revisionSchema = z.uuid();
const dateTimeSchema = z.iso.datetime();

export const publishedProductGlobalSchema = z.object({
  sourceVersion: z.number().int().min(0),
  sourceHash: sourceHashSchema,
  globalRevision: revisionSchema,
  publishedAt: dateTimeSchema,
  data: publishedProductGlobalDataSchema,
}).strict();

export const publishedProductLocaleSchema = z.object({
  sourceVersion: z.number().int().min(0),
  sourceHash: sourceHashSchema,
  globalRevision: revisionSchema,
  publicationRevision: revisionSchema,
  publishedAt: dateTimeSchema,
  data: publishedProductLocaleDataSchema,
}).strict();

function isPlainRecord(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateJsonDepth(
  value: unknown,
  depth: number,
  ancestors: Set<object>,
): string | undefined {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return undefined;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? undefined : "Numbers must be finite.";
  }
  if (typeof value !== "object") {
    return "Template data must contain JSON-compatible values only.";
  }
  if (depth >= PRODUCT_LIMITS.templateDataDepth) {
    return `Template data cannot exceed ${PRODUCT_LIMITS.templateDataDepth} nested containers.`;
  }
  if (ancestors.has(value)) {
    return "Template data cannot contain circular references.";
  }
  if (!Array.isArray(value) && !isPlainRecord(value)) {
    return "Template data objects must use plain JSON object values.";
  }

  ancestors.add(value);
  const children: unknown[] = Array.isArray(value)
    ? value
    : Object.values(value);
  for (const child of children) {
    const issue = validateJsonDepth(child, depth + 1, ancestors);
    if (issue !== undefined) {
      ancestors.delete(value);
      return issue;
    }
  }
  ancestors.delete(value);
  return undefined;
}

export const templateDataEnvelopeSchema = z
  .object({
    schemaVersion: z.number().int().min(1).max(10_000),
    data: z.unknown(),
  })
  .strict()
  .superRefine((value, context) => {
    const depthIssue = validateJsonDepth(value.data, 0, new Set());
    if (depthIssue !== undefined) {
      context.addIssue({ code: "custom", message: depthIssue, path: ["data"] });
      return;
    }
    const serialized = JSON.stringify(value);
    if (
      new TextEncoder().encode(serialized).byteLength >
      PRODUCT_LIMITS.templateDataBytes
    ) {
      context.addIssue({
        code: "custom",
        message: `Template data cannot exceed ${PRODUCT_LIMITS.templateDataBytes} serialized bytes.`,
        path: ["data"],
      });
    }
  });

export const productWorkingDataSchema = z.object({
  slug: productSlugSchema,
  categoryId: objectIdStringSchema,
  model: z.string().trim().max(PRODUCT_LIMITS.model).optional(),
  series: z.string().trim().max(PRODUCT_LIMITS.series).optional(),
  translations: productTranslationsSchema,
  specifications: productSpecificationsSchema,
  mediaUsages: productMediaUsagesSchema,
  pageTemplate: productTemplateIdSchema,
  displayOrder: productOrderSchema,
  featured: z.boolean(),
}).strict();

export const createProductRequestSchema = productWorkingDataSchema;

export const updateProductRequestSchema = productWorkingDataSchema
  .partial()
  .extend({
    version: z.number().int().min(0),
    model: z
      .string()
      .trim()
      .max(PRODUCT_LIMITS.model)
      .nullable()
      .optional(),
    series: z
      .string()
      .trim()
      .max(PRODUCT_LIMITS.series)
      .nullable()
      .optional(),
  })
  .refine(
    ({ version: _version, ...changes }) =>
      Object.values(changes).some((value) => value !== undefined),
    { message: "At least one product field must be updated." },
  );

export const productAdminDtoSchema = productWorkingDataSchema.extend({
  id: objectIdStringSchema,
  publishedGlobal: publishedProductGlobalSchema.optional(),
  publishedSnapshots: z.partialRecord(
    localeCodeSchema,
    publishedProductLocaleSchema,
  ),
  workingGlobalHash: sourceHashSchema,
  workingLocaleHashes: z.partialRecord(localeCodeSchema, sourceHashSchema),
  sharedState: z.enum(["draft", "published", "changes-pending"]),
  localeStates: z.record(
    localeCodeSchema,
    z.enum(["incomplete", "draft", "published", "changes-pending"]),
  ),
  status: productStatusSchema,
  firstPublishedAt: dateTimeSchema.optional(),
  createdBy: objectIdStringSchema,
  updatedBy: objectIdStringSchema,
  createdAt: dateTimeSchema,
  updatedAt: dateTimeSchema,
  version: z.number().int().min(0),
}).strict();

export const productPublicationIssueSchema = fieldErrorSchema.extend({
  severity: z.enum(["error", "warning"]),
});

export const productPublicationValidationResultSchema = z
  .object({
    publishable: z.boolean(),
    errors: z.array(
      productPublicationIssueSchema.extend({ severity: z.literal("error") }),
    ),
    warnings: z.array(
      productPublicationIssueSchema.extend({ severity: z.literal("warning") }),
    ),
  })
  .strict();

export const publishProductRequestSchema = z
  .object({
    version: z.number().int().min(0),
    locales: z.array(localeCodeSchema).min(1),
    promoteShared: z.boolean().default(false),
  })
  .superRefine(({ locales }, context) => {
    const seen = new Set<string>();
    for (const [index, locale] of locales.entries()) {
      if (seen.has(locale)) {
        context.addIssue({
          code: "custom",
          message: `The locale "${locale}" can only be requested once.`,
          path: ["locales", index],
        });
      }
      seen.add(locale);
    }
  });

export const unpublishProductRequestSchema = z
  .object({
    version: z.number().int().min(0),
    locale: localeCodeSchema.optional(),
  })
  .strict();

export const duplicateProductRequestSchema = z
  .object({
    version: z.number().int().min(0),
    slug: productSlugSchema.optional(),
  })
  .strict();

export const productVersionRequestSchema = z
  .object({ version: z.number().int().min(0) })
  .strict();

export const productPublicationResultSchema = z
  .object({
    product: productAdminDtoSchema,
    validation: productPublicationValidationResultSchema,
  })
  .strict();

export const productDeletedDtoSchema = z
  .object({ deleted: z.literal(true) })
  .strict();

export const productSummaryDtoSchema = z.object({
  id: objectIdStringSchema,
  slug: productSlugSchema,
  name: z.string().min(1).max(PRODUCT_LIMITS.name),
  model: z.string().max(PRODUCT_LIMITS.model).optional(),
  categoryId: objectIdStringSchema,
  pageTemplate: legacyTemplateIdSchema,
  availableLocales: z.array(localeCodeSchema).min(1),
});

export const adminProductStatusSchema = z.enum([
  "draft",
  "published",
  "archived",
]);

export const productLocaleStateSchema = z.enum([
  "incomplete",
  "draft",
  "published",
  "changes-pending",
]);

export const productListSortSchema = z.enum([
  "updated-desc",
  "updated-asc",
  "order-asc",
  "order-desc",
  "name-asc",
  "name-desc",
]);

export const adminProductListQuerySchema = paginationQuerySchema
  .extend({
    search: z.string().trim().min(1).max(120).optional(),
    categoryId: objectIdStringSchema.optional(),
    status: adminProductStatusSchema.optional(),
    locale: localeCodeSchema.default(DEFAULT_LOCALE),
    localeState: productLocaleStateSchema.optional(),
    featured: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    sort: productListSortSchema.default("updated-desc"),
  })
  .strict();

export const productTranslationCompletenessSchema = z
  .object({
    hasTranslation: z.boolean(),
    hasName: z.boolean(),
    hasShortDescription: z.boolean(),
    hasLongDescription: z.boolean(),
    localizedSpecificationGroups: z.number().int().nonnegative(),
    requiredSpecificationGroups: z.number().int().nonnegative(),
    complete: z.boolean(),
  })
  .strict();

export const adminProductListItemSchema = z
  .object({
    id: objectIdStringSchema,
    slug: productSlugSchema,
    name: z.string().min(1).max(PRODUCT_LIMITS.name),
    nameLocale: localeCodeSchema.optional(),
    names: z.partialRecord(
      localeCodeSchema,
      z.string().min(1).max(PRODUCT_LIMITS.name),
    ),
    model: z.string().max(PRODUCT_LIMITS.model).optional(),
    series: z.string().max(PRODUCT_LIMITS.series).optional(),
    categoryId: objectIdStringSchema,
    pageTemplate: productTemplateIdSchema,
    displayOrder: productOrderSchema,
    featured: z.boolean(),
    status: adminProductStatusSchema,
    sharedState: z.enum(["draft", "published", "changes-pending"]),
    localeStates: z.record(localeCodeSchema, productLocaleStateSchema),
    translationCompleteness: z.record(
      localeCodeSchema,
      productTranslationCompletenessSchema,
    ),
    publishedLocales: z.array(localeCodeSchema),
    canDeletePermanently: z.boolean(),
    updatedAt: dateTimeSchema,
    version: z.number().int().min(0),
  })
  .strict();

export const productCollectionCountsSchema = z
  .object({
    all: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    archived: z.number().int().nonnegative(),
    featured: z.number().int().nonnegative(),
  })
  .strict();

export const adminProductListDtoSchema = z
  .object({
    items: z.array(adminProductListItemSchema),
    pagination: z.object({
      page: z.number().int().min(1),
      limit: z.number().int().min(1).max(100),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
    collectionCounts: productCollectionCountsSchema,
  })
  .strict();

export const publicProductListSortSchema = z.enum([
  "order-asc",
  "order-desc",
  "name-asc",
  "name-desc",
  "updated-desc",
]);

export const publicProductListQuerySchema = paginationQuerySchema
  .extend({
    locale: localeCodeSchema,
    category: categorySlugSchema.optional(),
    featured: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    sort: publicProductListSortSchema.default("order-asc"),
  })
  .strict();

export const publicProductVisibilityQuerySchema = z
  .object({ locale: localeCodeSchema })
  .strict();

export const publicProductDetailQuerySchema = z
  .object({
    locale: localeCodeSchema,
    publicationRevision: revisionSchema,
  })
  .strict();

export const publicProductBreadcrumbSchema = z
  .object({
    slug: categorySlugSchema,
    name: z.string().min(1).max(160),
  })
  .strict();

export const publicProductCategorySchema = z
  .object({
    id: objectIdStringSchema,
    slug: categorySlugSchema,
    name: z.string().min(1).max(160),
    breadcrumbs: z.array(publicProductBreadcrumbSchema).min(1).max(2),
  })
  .strict();

export const publicProductMediaUsageDtoSchema = publicMediaDtoSchema
  .extend({
    role: productMediaRoleSchema,
    order: productOrderSchema,
    locale: localeCodeSchema.optional(),
    durationSeconds: z.number().nonnegative().optional(),
    poster: publicMediaDtoSchema.optional(),
    alt: z.string().min(1).max(PRODUCT_LIMITS.mediaText).optional(),
    title: z.string().min(1).max(PRODUCT_LIMITS.mediaText).optional(),
    caption: z.string().min(1).max(PRODUCT_LIMITS.mediaCaption).optional(),
  })
  .strict();

export const publicProductSummaryDtoSchema = z
  .object({
    id: objectIdStringSchema,
    slug: productSlugSchema,
    name: z.string().min(1).max(PRODUCT_LIMITS.name),
    shortDescription: z.string().min(1).max(PRODUCT_LIMITS.shortDescription),
    model: z.string().max(PRODUCT_LIMITS.model).optional(),
    series: z.string().max(PRODUCT_LIMITS.series).optional(),
    category: publicProductCategorySchema,
    pageTemplate: legacyTemplateIdSchema,
    featured: z.boolean(),
    publicationRevision: revisionSchema,
    updatedAt: dateTimeSchema,
    availableLocales: z.array(localeCodeSchema).min(1),
    primaryMedia: publicProductMediaUsageDtoSchema.optional(),
    fallbackFields: z.array(z.string().min(1).max(240)),
  })
  .strict();

export const publicProductListDtoSchema = z
  .object({
    items: z.array(publicProductSummaryDtoSchema),
    pagination: z
      .object({
        page: z.number().int().min(1),
        limit: z.number().int().min(1).max(100),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export const publicProductSpecificationItemSchema = z
  .object({
    key: productNestedKeySchema,
    label: z.string().min(1).max(PRODUCT_LIMITS.specificationLabel),
    order: productOrderSchema,
    value: z.string().max(PRODUCT_LIMITS.specificationValue),
    unit: z.string().max(PRODUCT_LIMITS.specificationUnit).optional(),
    note: z.string().max(PRODUCT_LIMITS.specificationNote).optional(),
  })
  .strict();

export const publicProductSpecificationGroupSchema = z
  .object({
    key: productNestedKeySchema,
    label: z.string().min(1).max(PRODUCT_LIMITS.specificationLabel),
    order: productOrderSchema,
    items: z.array(publicProductSpecificationItemSchema),
  })
  .strict();

export const publicProductFeatureSchema = productFeatureSchema
  .omit({ iconMediaId: true })
  .extend({ iconMedia: publicMediaDtoSchema.optional() })
  .strict();

export const publicProductSeoDtoSchema = z
  .object({
    focusKeyphrase: z.string().max(160).optional(),
    title: z.string().min(1).max(PRODUCT_LIMITS.seoTitle),
    description: z.string().max(PRODUCT_LIMITS.seoDescription).optional(),
    keywords: z.array(z.string().min(1).max(PRODUCT_LIMITS.seoKeyword)),
    openGraphTitle: z.string().max(PRODUCT_LIMITS.seoTitle).optional(),
    openGraphDescription: z
      .string()
      .max(PRODUCT_LIMITS.seoDescription)
      .optional(),
    openGraphMedia: publicMediaDtoSchema.optional(),
    canonicalUrlOverride: z.string().url().max(2_048).optional(),
    robots: z.object({ index: z.boolean(), follow: z.boolean() }).strict().optional(),
  })
  .strict();

export const publicProductDetailDtoSchema = publicProductSummaryDtoSchema
  .omit({ primaryMedia: true })
  .extend({
    longDescriptionMarkdown: z
      .string()
      .max(PRODUCT_LIMITS.longDescriptionMarkdown)
      .optional(),
    features: z.array(publicProductFeatureSchema),
    advantages: z.array(productTextItemSchema),
    applications: z.array(productTextItemSchema),
    warrantyInformation: z
      .string()
      .max(PRODUCT_LIMITS.warrantyInformation)
      .optional(),
    seo: publicProductSeoDtoSchema,
    specifications: z.array(publicProductSpecificationGroupSchema),
    media: z.array(publicProductMediaUsageDtoSchema),
    relatedProducts: z.array(publicProductSummaryDtoSchema).max(6),
  })
  .strict();

export const publicProductVisibilityDtoSchema = z
  .object({
    slug: productSlugSchema,
    locale: localeCodeSchema,
    publicationRevision: revisionSchema,
    updatedAt: dateTimeSchema,
    availableLocales: z.array(localeCodeSchema).min(1),
  })
  .strict();

export const publicSitemapEntriesQuerySchema = paginationQuerySchema.strict();

export const publicSitemapEntrySchema = z
  .object({
    kind: z.enum(["category", "product"]),
    locale: localeCodeSchema,
    slug: z.string().min(2).max(140),
    path: z.string().startsWith("/").max(320),
    updatedAt: dateTimeSchema,
    availableLocales: z.array(localeCodeSchema).min(1),
  })
  .strict();

export const publicSitemapEntriesDtoSchema = z
  .object({
    items: z.array(publicSitemapEntrySchema),
    pagination: z
      .object({
        page: z.number().int().min(1),
        limit: z.number().int().min(1).max(100),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .strict(),
  })
  .strict();

export type ProductFeature = z.infer<typeof productFeatureSchema>;
export type ProductTextItem = z.infer<typeof productTextItemSchema>;
export type ProductSeo = z.infer<typeof productSeoSchema>;
export type ProductTranslation = z.infer<typeof productTranslationSchema>;
export type SpecificationItem = z.infer<typeof specificationItemSchema>;
export type SpecificationGroup = z.infer<typeof specificationGroupSchema>;
export type ProductMediaUsage = z.infer<typeof productMediaUsageSchema>;
export type ProductStatus = z.infer<typeof productStatusSchema>;
export type PublishedProductGlobalData = z.infer<
  typeof publishedProductGlobalDataSchema
>;
export type PublishedProductLocaleData = z.infer<
  typeof publishedProductLocaleDataSchema
>;
export type PublishedProductGlobal = z.infer<
  typeof publishedProductGlobalSchema
>;
export type PublishedProductLocale = z.infer<
  typeof publishedProductLocaleSchema
>;
export type TemplateDataEnvelope = z.infer<typeof templateDataEnvelopeSchema>;
export type ProductWorkingData = z.infer<typeof productWorkingDataSchema>;
export type CreateProductRequest = z.infer<typeof createProductRequestSchema>;
export type UpdateProductRequest = z.infer<typeof updateProductRequestSchema>;
export type ProductAdminDto = z.infer<typeof productAdminDtoSchema>;
export type ProductSummaryDto = z.infer<typeof productSummaryDtoSchema>;
export type AdminProductListQuery = z.output<
  typeof adminProductListQuerySchema
>;
export type AdminProductListItem = z.infer<
  typeof adminProductListItemSchema
>;
export type AdminProductListDto = z.infer<typeof adminProductListDtoSchema>;
export type PublicProductListQuery = z.output<
  typeof publicProductListQuerySchema
>;
export type PublicProductSummaryDto = z.infer<
  typeof publicProductSummaryDtoSchema
>;
export type PublicProductListDto = z.infer<
  typeof publicProductListDtoSchema
>;
export type PublicProductMediaUsageDto = z.infer<
  typeof publicProductMediaUsageDtoSchema
>;
export type PublicProductDetailDto = z.infer<
  typeof publicProductDetailDtoSchema
>;
export type PublicProductVisibilityDto = z.infer<
  typeof publicProductVisibilityDtoSchema
>;
export type PublicSitemapEntriesDto = z.infer<
  typeof publicSitemapEntriesDtoSchema
>;
export type ProductPublicationIssue = z.infer<
  typeof productPublicationIssueSchema
>;
export type ProductPublicationValidationResult = z.infer<
  typeof productPublicationValidationResultSchema
>;
export type PublishProductRequest = z.infer<
  typeof publishProductRequestSchema
>;
export type UnpublishProductRequest = z.infer<
  typeof unpublishProductRequestSchema
>;
export type DuplicateProductRequest = z.infer<
  typeof duplicateProductRequestSchema
>;
