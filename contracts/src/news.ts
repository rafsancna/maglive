import { z } from "zod";
import { objectIdStringSchema, paginationQuerySchema } from "./api.js";
import { localeCodeSchema } from "./locale.js";
import { publicMediaDtoSchema } from "./media.js";

export const NEWS_LIMITS = Object.freeze({
  title: 180,
  excerpt: 500,
  author: 120,
  blocks: 150,
  blockText: 20_000,
  listItems: 100,
  tags: 20,
  tag: 48,
  seoTitle: 70,
  seoDescription: 320,
  seoKeywords: 20,
} as const);

const optionalText = (maximum: number) =>
  z.string().trim().min(1).max(maximum).optional();
export const newsSlugSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((slug) => !["new", "admin", "api", "preview"].includes(slug), {
    message: "The news slug is reserved.",
  });
export function createNewsSlugBase(title: string): string {
  const value = title
    .replace(/\p{S}/gu, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140)
    .replace(/-+$/g, "");
  return ["new", "admin", "api", "preview"].includes(value)
    ? `${value}-news`
    : value;
}
export const newsCategorySchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const blockIdSchema = z.uuid();
const newsSimpleTextMarkSchema = z
  .object({ type: z.enum(["bold", "italic", "underline", "strike", "code"]) })
  .strict();
const newsInlineLinkMarkSchema = z
  .object({
    type: z.literal("link"),
    href: z
      .string()
      .trim()
      .min(1)
      .max(2_048)
      .refine((href) => /^(?:https?:\/\/|mailto:|tel:|\/[^/])/i.test(href), {
        message:
          "News links must use http, https, mailto, tel, or an internal path.",
      }),
    newWindow: z.boolean().optional(),
  })
  .strict();
export const newsTextMarkSchema = z.union([
  newsSimpleTextMarkSchema,
  newsInlineLinkMarkSchema,
]);
export type NewsTextMark = z.infer<typeof newsTextMarkSchema>;
export const newsInlineTextSchema = z
  .object({
    type: z.literal("text"),
    text: z.string().min(1).max(NEWS_LIMITS.blockText),
    marks: z.array(newsTextMarkSchema).max(6).optional(),
  })
  .strict();
export const newsInlineBreakSchema = z
  .object({ type: z.literal("hardBreak") })
  .strict();
export const newsInlineNodeSchema = z.union([
  newsInlineTextSchema,
  newsInlineBreakSchema,
]);
export const newsInlineContentSchema = z
  .array(newsInlineNodeSchema)
  .min(1)
  .max(4_000);
export type NewsInlineContent = z.infer<typeof newsInlineContentSchema>;
export const newsTextAlignmentSchema = z.enum(["left", "center", "right"]);
export const newsParagraphBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("paragraph"),
    text: z.string().trim().min(1).max(NEWS_LIMITS.blockText),
    richText: newsInlineContentSchema.optional(),
    alignment: newsTextAlignmentSchema.optional(),
  })
  .strict();
export const newsHeadingBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("heading"),
    level: z.union([z.literal(2), z.literal(3)]),
    text: z.string().trim().min(1).max(240),
    richText: newsInlineContentSchema.optional(),
    alignment: newsTextAlignmentSchema.optional(),
  })
  .strict();
export const newsQuoteBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("quote"),
    text: z.string().trim().min(1).max(4_000),
    richText: newsInlineContentSchema.optional(),
    attribution: optionalText(240),
  })
  .strict();
export const newsListBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("list"),
    style: z.enum(["bulleted", "numbered"]),
    items: z
      .array(z.string().trim().min(1).max(1_000))
      .min(1)
      .max(NEWS_LIMITS.listItems),
    richItems: z
      .array(newsInlineContentSchema)
      .min(1)
      .max(NEWS_LIMITS.listItems)
      .optional(),
  })
  .strict();
export const newsDividerBlockSchema = z
  .object({ id: blockIdSchema, type: z.literal("divider") })
  .strict();
export const newsMediaDisplaySizeSchema = z.enum([
  "compact",
  "medium",
  "large",
  "full",
]);
export const newsMediaAlignmentSchema = z.enum(["left", "center", "right"]);
export const newsMediaAspectRatioSchema = z.enum([
  "original",
  "landscape",
  "classic",
  "square",
  "portrait",
]);
export const newsMediaFocalPointSchema = z.enum(["top", "center", "bottom"]);
export type NewsMediaDisplaySize = z.infer<typeof newsMediaDisplaySizeSchema>;
export type NewsMediaAlignment = z.infer<typeof newsMediaAlignmentSchema>;
export type NewsMediaAspectRatio = z.infer<typeof newsMediaAspectRatioSchema>;
export type NewsMediaFocalPoint = z.infer<typeof newsMediaFocalPointSchema>;
export const newsMediaBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.enum(["image", "video"]),
    mediaId: objectIdStringSchema,
    alt: optionalText(240),
    caption: optionalText(1_000),
    displaySize: newsMediaDisplaySizeSchema.optional(),
    alignment: newsMediaAlignmentSchema.optional(),
    aspectRatio: newsMediaAspectRatioSchema.optional(),
    focalPoint: newsMediaFocalPointSchema.optional(),
  })
  .strict();
export const newsDocumentBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("document"),
    mediaId: objectIdStringSchema,
    label: z.string().trim().min(1).max(240),
    description: optionalText(1_000),
  })
  .strict();
export const newsLinkBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("link"),
    label: z.string().trim().min(1).max(240),
    url: z.string().trim().url().max(2_048),
    description: optionalText(1_000),
    newWindow: z.boolean().default(false),
  })
  .strict();
export const newsContentBlockSchema = z.discriminatedUnion("type", [
  newsParagraphBlockSchema,
  newsHeadingBlockSchema,
  newsQuoteBlockSchema,
  newsListBlockSchema,
  newsDividerBlockSchema,
  newsMediaBlockSchema,
  newsDocumentBlockSchema,
  newsLinkBlockSchema,
]);
export type NewsContentBlock = z.infer<typeof newsContentBlockSchema>;

export const newsSeoSchema = z
  .object({
    focusKeyphrase: optionalText(160),
    title: optionalText(NEWS_LIMITS.seoTitle),
    description: optionalText(NEWS_LIMITS.seoDescription),
    keywords: z
      .array(z.string().trim().min(1).max(80))
      .max(NEWS_LIMITS.seoKeywords)
      .default([]),
    openGraphTitle: optionalText(NEWS_LIMITS.seoTitle),
    openGraphDescription: optionalText(NEWS_LIMITS.seoDescription),
    openGraphMediaId: objectIdStringSchema.optional(),
    canonicalUrlOverride: z.string().trim().url().max(2_048).optional(),
    robots: z
      .object({ index: z.boolean(), follow: z.boolean() })
      .strict()
      .optional(),
  })
  .strict();
export const newsTranslationSchema = z
  .object({
    title: z.string().trim().min(1).max(NEWS_LIMITS.title),
    excerpt: z.string().trim().min(1).max(NEWS_LIMITS.excerpt),
    content: z.array(newsContentBlockSchema).min(1).max(NEWS_LIMITS.blocks),
    seo: newsSeoSchema.default({ keywords: [] }),
  })
  .strict();
export const newsTranslationsSchema = z.partialRecord(
  localeCodeSchema,
  newsTranslationSchema,
);
export const newsStatusSchema = z.enum(["draft", "published", "archived"]);
export const newsLocaleStateSchema = z.enum([
  "incomplete",
  "draft",
  "published",
  "changes-pending",
]);
const dateTimeSchema = z.iso.datetime();
export const publishedNewsGlobalSchema = z
  .object({
    slug: newsSlugSchema,
    category: newsCategorySchema,
    authorName: z.string().trim().min(1).max(NEWS_LIMITS.author),
    featured: z.boolean(),
    tags: z
      .array(z.string().trim().min(1).max(NEWS_LIMITS.tag))
      .max(NEWS_LIMITS.tags),
    heroMediaId: objectIdStringSchema.optional(),
    publishedAt: dateTimeSchema,
  })
  .strict();
export const publishedNewsLocaleSchema = z
  .object({ publishedAt: dateTimeSchema, data: newsTranslationSchema })
  .strict();

export const newsAdminDtoSchema = z
  .object({
    id: objectIdStringSchema,
    slug: newsSlugSchema,
    category: newsCategorySchema,
    authorName: z.string(),
    featured: z.boolean(),
    tags: z.array(z.string()),
    heroMediaId: objectIdStringSchema.optional(),
    translations: newsTranslationsSchema,
    status: newsStatusSchema,
    publishedGlobal: publishedNewsGlobalSchema.optional(),
    publishedSnapshots: z.partialRecord(
      localeCodeSchema,
      publishedNewsLocaleSchema,
    ),
    localeStates: z.record(localeCodeSchema, newsLocaleStateSchema),
    firstPublishedAt: dateTimeSchema.optional(),
    createdBy: objectIdStringSchema,
    updatedBy: objectIdStringSchema,
    createdAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    version: z.number().int().min(0),
  })
  .strict();
export type NewsAdminDto = z.infer<typeof newsAdminDtoSchema>;
export const createNewsRequestSchema = z
  .object({
    slug: newsSlugSchema,
    category: newsCategorySchema.default("company-news"),
    authorName: z.string().trim().min(1).max(NEWS_LIMITS.author),
    featured: z.boolean().default(false),
    tags: z
      .array(z.string().trim().min(1).max(NEWS_LIMITS.tag))
      .max(NEWS_LIMITS.tags)
      .default([]),
    heroMediaId: objectIdStringSchema.optional(),
    translations: newsTranslationsSchema.default({}),
  })
  .strict();
export type CreateNewsRequest = z.infer<typeof createNewsRequestSchema>;
export const updateNewsRequestSchema = z
  .object({
    version: z.number().int().min(0),
    slug: newsSlugSchema.optional(),
    category: newsCategorySchema.optional(),
    authorName: z.string().trim().min(1).max(NEWS_LIMITS.author).optional(),
    featured: z.boolean().optional(),
    tags: z
      .array(z.string().trim().min(1).max(NEWS_LIMITS.tag))
      .max(NEWS_LIMITS.tags)
      .optional(),
    heroMediaId: objectIdStringSchema.nullable().optional(),
    translations: newsTranslationsSchema.optional(),
  })
  .refine(
    ({ version: _version, ...changes }) =>
      Object.values(changes).some((value) => value !== undefined),
    { message: "At least one news field must be updated." },
  );
export type UpdateNewsRequest = z.infer<typeof updateNewsRequestSchema>;
export const newsVersionRequestSchema = z.object({
  version: z.number().int().min(0),
});
export const publishNewsRequestSchema = newsVersionRequestSchema.extend({
  locales: z.array(localeCodeSchema).min(1),
});
export const unpublishNewsRequestSchema = newsVersionRequestSchema.extend({
  locale: localeCodeSchema.optional(),
});
export type PublishNewsRequest = z.infer<typeof publishNewsRequestSchema>;
export type UnpublishNewsRequest = z.infer<typeof unpublishNewsRequestSchema>;
export const adminNewsListQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().max(120).optional(),
  locale: localeCodeSchema.optional(),
  status: newsStatusSchema.optional(),
  category: newsCategorySchema.optional(),
});
export const adminNewsListDtoSchema = z.object({
  items: z.array(newsAdminDtoSchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type AdminNewsListQuery = z.infer<typeof adminNewsListQuerySchema>;
export type AdminNewsListDto = z.infer<typeof adminNewsListDtoSchema>;

const publicResolvedMediaBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.enum(["image", "video"]),
    media: publicMediaDtoSchema,
    alt: optionalText(240),
    caption: optionalText(1_000),
    displaySize: newsMediaDisplaySizeSchema.optional(),
    alignment: newsMediaAlignmentSchema.optional(),
    aspectRatio: newsMediaAspectRatioSchema.optional(),
    focalPoint: newsMediaFocalPointSchema.optional(),
  })
  .strict();
const publicResolvedDocumentBlockSchema = z
  .object({
    id: blockIdSchema,
    type: z.literal("document"),
    media: publicMediaDtoSchema,
    label: z.string().min(1),
    description: optionalText(1_000),
  })
  .strict();
export const publicNewsContentBlockSchema = z.discriminatedUnion("type", [
  newsParagraphBlockSchema,
  newsHeadingBlockSchema,
  newsQuoteBlockSchema,
  newsListBlockSchema,
  newsDividerBlockSchema,
  publicResolvedMediaBlockSchema,
  publicResolvedDocumentBlockSchema,
  newsLinkBlockSchema,
]);
export type PublicNewsContentBlock = z.infer<
  typeof publicNewsContentBlockSchema
>;
export const publicNewsSeoSchema = newsSeoSchema
  .extend({ openGraphMedia: publicMediaDtoSchema.optional() })
  .omit({ openGraphMediaId: true });
export const publicNewsSummaryDtoSchema = z
  .object({
    id: objectIdStringSchema,
    slug: newsSlugSchema,
    category: newsCategorySchema,
    authorName: z.string(),
    featured: z.boolean(),
    tags: z.array(z.string()),
    title: z.string(),
    excerpt: z.string(),
    heroMedia: publicMediaDtoSchema.optional(),
    publishedAt: dateTimeSchema,
    updatedAt: dateTimeSchema,
    availableLocales: z.array(localeCodeSchema),
  })
  .strict();
export type PublicNewsSummaryDto = z.infer<typeof publicNewsSummaryDtoSchema>;
export const publicNewsDetailDtoSchema = publicNewsSummaryDtoSchema
  .extend({
    content: z.array(publicNewsContentBlockSchema),
    seo: publicNewsSeoSchema,
    readingMinutes: z.number().int().positive(),
  })
  .strict();
export type PublicNewsDetailDto = z.infer<typeof publicNewsDetailDtoSchema>;
const queryBooleanSchema = z.preprocess(
  (value) => (value === "true" ? true : value === "false" ? false : value),
  z.boolean(),
);
export const publicNewsListQuerySchema = paginationQuerySchema.extend({
  locale: localeCodeSchema,
  category: newsCategorySchema.optional(),
  tag: z.string().trim().max(NEWS_LIMITS.tag).optional(),
  search: z.string().trim().max(120).optional(),
  featured: queryBooleanSchema.optional(),
});
export type PublicNewsListQuery = z.infer<typeof publicNewsListQuerySchema>;
export const publicNewsListDtoSchema = z.object({
  items: z.array(publicNewsSummaryDtoSchema),
  categories: z.array(newsCategorySchema),
  pagination: z.object({
    page: z.number().int(),
    limit: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type PublicNewsListDto = z.infer<typeof publicNewsListDtoSchema>;
export const newsDeletedDtoSchema = z.object({ deleted: z.literal(true) });
