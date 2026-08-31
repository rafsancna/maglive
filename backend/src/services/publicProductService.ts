import {
  DEFAULT_LOCALE,
  isLocaleCode,
  type LocaleCode,
  type PublicMediaDto,
  type PublicProductDetailDto,
  type PublicProductListDto,
  type PublicProductListQuery,
  type PublicProductMediaUsageDto,
  type PublicProductSummaryDto,
  type PublicProductVisibilityDto,
  type PublicSitemapEntriesDto,
} from "@maglive/contracts";
import type { QueryFilter, SortOrder, Types } from "mongoose";
import { AppError } from "../errors/AppError.js";
import type { CategoryDocument } from "../models/Category.js";
import { MediaModel, type MediaDocument } from "../models/Media.js";
import {
  ProductModel,
  type Product,
  type ProductDocument,
  type PublishedProductGlobal,
  type PublishedProductGlobalMediaUsage,
  type PublishedProductLocale,
  type PublishedProductLocaleMediaUsage,
} from "../models/Product.js";
import type { StorageProvider } from "../storage/StorageProvider.js";
import { requireLanguage } from "./languageService.js";
import {
  coherentCategoryChain,
  loadPublicCategoryDocuments,
  toPublicCategoryDto,
} from "./categoryService.js";

type CategoryCatalog = Readonly<{
  documents: CategoryDocument[];
  byId: ReadonlyMap<string, CategoryDocument>;
}>;

type PublicProductContext = Readonly<{
  product: ProductDocument;
  global: PublishedProductGlobal;
  localized: PublishedProductLocale;
  category: CategoryDocument;
  chain: CategoryDocument[];
}>;

type SitemapQuery = Readonly<{ page: number; limit: number }>;

const relatedProductLimit = 4;

function snapshotError(): AppError {
  return new AppError(
    500,
    "PRODUCT_SNAPSHOT_INVALID",
    "A published product snapshot is inconsistent.",
  );
}

function productNotFound(): AppError {
  return new AppError(404, "PRODUCT_NOT_FOUND", "The product was not found.");
}

async function loadCategoryCatalog(): Promise<CategoryCatalog> {
  const documents = await loadPublicCategoryDocuments();
  return {
    documents,
    byId: new Map(
      documents.map((category) => [category._id.toString(), category]),
    ),
  };
}

function coherentProductContext(
  product: ProductDocument,
  locale: LocaleCode,
  catalog: CategoryCatalog,
): PublicProductContext | undefined {
  const global = product.publishedGlobal;
  const localized = product.publishedSnapshots.get(locale);
  if (
    product.status !== "published" ||
    global === undefined ||
    localized === undefined ||
    localized.globalRevision !== global.globalRevision
  ) {
    return undefined;
  }
  const category = catalog.byId.get(global.data.categoryId.toString());
  if (category === undefined) return undefined;
  const chain = coherentCategoryChain(category, locale, catalog.byId);
  if (chain === undefined) return undefined;
  return { product, global, localized, category, chain };
}

function availableLocales(
  product: ProductDocument,
  catalog: CategoryCatalog,
): LocaleCode[] {
  return [...product.publishedSnapshots.keys()].filter(
    (locale) =>
      isLocaleCode(locale) &&
      coherentProductContext(product, locale, catalog) !== undefined,
  );
}

function publicUpdatedAt(context: PublicProductContext): string {
  return new Date(
    Math.max(
      context.global.publishedAt.getTime(),
      context.localized.publishedAt.getTime(),
    ),
  ).toISOString();
}

function publicCategory(
  context: PublicProductContext,
  locale: LocaleCode,
  catalog: CategoryCatalog,
): PublicProductSummaryDto["category"] {
  const category = toPublicCategoryDto(context.category, locale, catalog.byId);
  if (category === undefined) throw snapshotError();
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    breadcrumbs: category.breadcrumbs,
  };
}

function optionalFallback<T>(
  localized: T | undefined,
  fallback: T | undefined,
  path: string,
  fallbackFields: Set<string>,
): T | undefined {
  if (localized !== undefined) return localized;
  if (fallback !== undefined) fallbackFields.add(path);
  return fallback;
}

function usageKey(
  usage: Pick<
    PublishedProductLocaleMediaUsage,
    "mediaId" | "role" | "order" | "locale"
  >,
): string {
  return [
    usage.mediaId.toString(),
    usage.role,
    usage.order.toString(),
    usage.locale ?? "",
  ].join("|");
}

function sortedLocaleMedia(
  context: PublicProductContext,
  locale: LocaleCode,
): PublishedProductLocaleMediaUsage[] {
  const localizedByKey = new Map(
    context.localized.data.mediaUsages.map((usage) => [usageKey(usage), usage]),
  );
  const shared = context.global.data.mediaUsages
    .filter((usage) => usage.locale === undefined || usage.locale === locale)
    .sort(
      (left, right) =>
        left.order - right.order ||
        left.role.localeCompare(right.role) ||
        left.mediaId.toString().localeCompare(right.mediaId.toString()),
    );
  if (shared.length !== context.localized.data.mediaUsages.length) {
    throw snapshotError();
  }
  return shared.map((usage: PublishedProductGlobalMediaUsage) => {
    const localized = localizedByKey.get(usageKey(usage));
    if (localized === undefined) throw snapshotError();
    return {
      mediaId: usage.mediaId,
      role: usage.role,
      order: usage.order,
      ...(usage.locale === undefined ? {} : { locale: usage.locale }),
      ...(localized.alt === undefined ? {} : { alt: localized.alt }),
      ...(localized.title === undefined ? {} : { title: localized.title }),
      ...(localized.caption === undefined
        ? {}
        : { caption: localized.caption }),
    };
  });
}

function sortedSnapshotMedia(
  snapshot: PublishedProductLocale,
): PublishedProductLocaleMediaUsage[] {
  return [...snapshot.data.mediaUsages].sort(
    (left, right) =>
      left.order - right.order ||
      left.role.localeCompare(right.role) ||
      left.mediaId.toString().localeCompare(right.mediaId.toString()),
  );
}

function primaryMediaUsage(
  context: PublicProductContext,
  locale: LocaleCode,
): PublishedProductLocaleMediaUsage | undefined {
  const candidates = sortedLocaleMedia(context, locale).filter(
    (usage) => usage.role === "hero" || usage.role === "gallery",
  );
  return (
    candidates.find((usage) => usage.role === "hero") ?? candidates.at(0)
  );
}

function publicMedia(
  media: MediaDocument,
  storageProvider: StorageProvider,
): PublicMediaDto {
  if (
    media.status !== "ready" ||
    media.storage === undefined ||
    media.storage.provider !== storageProvider.id
  ) {
    throw new AppError(
      503,
      "PUBLIC_MEDIA_UNAVAILABLE",
      "A published media asset is temporarily unavailable.",
    );
  }
  return {
    id: media._id.toString(),
    kind: media.kind,
    url: storageProvider.getPublicUrl(media.storage.key),
    mimeType: media.mimeType,
    ...(media.width === undefined ? {} : { width: media.width }),
    ...(media.height === undefined ? {} : { height: media.height }),
    ...(media.variants.length === 0
      ? {}
      : {
          variants: media.variants.map((variant) => ({
            label: variant.label,
            url: storageProvider.getPublicUrl(variant.storage.key),
            mimeType: variant.mimeType,
            sizeBytes: variant.sizeBytes,
            ...(variant.width === undefined ? {} : { width: variant.width }),
            ...(variant.height === undefined ? {} : { height: variant.height }),
            ...(variant.codec === undefined ? {} : { codec: variant.codec }),
          })),
        }),
  };
}

async function loadMedia(
  mediaIds: ReadonlySet<string>,
): Promise<ReadonlyMap<string, MediaDocument>> {
  if (mediaIds.size === 0) return new Map();
  const media = await MediaModel.find({
    _id: { $in: [...mediaIds] },
    status: "ready",
  });
  const posterIds = new Set(
    media.flatMap((item) =>
      item.posterMediaId === undefined ? [] : [item.posterMediaId.toString()],
    ),
  );
  const posters =
    posterIds.size === 0
      ? []
      : await MediaModel.find({
          _id: { $in: [...posterIds] },
          status: "ready",
          kind: "image",
        });
  return new Map(
    [...media, ...posters].map((item) => [item._id.toString(), item]),
  );
}

function requireMedia(
  id: string | Types.ObjectId,
  mediaById: ReadonlyMap<string, MediaDocument>,
): MediaDocument {
  const media = mediaById.get(id.toString());
  if (media === undefined) {
    throw new AppError(
      503,
      "PUBLIC_MEDIA_UNAVAILABLE",
      "A published media asset is temporarily unavailable.",
    );
  }
  return media;
}

function resolvedUsageText(
  values: readonly (string | undefined)[],
  path: string,
  fallbackFields: Set<string>,
): string | undefined {
  for (const [index, value] of values.entries()) {
    if (value !== undefined) {
      if (index > 0) fallbackFields.add(path);
      return value;
    }
  }
  return undefined;
}

function mapMediaUsage(
  usage: PublishedProductLocaleMediaUsage,
  index: number,
  locale: LocaleCode,
  fallbackSnapshot: PublishedProductLocale | undefined,
  mediaById: ReadonlyMap<string, MediaDocument>,
  storageProvider: StorageProvider,
  fallbackFields: Set<string>,
  pathPrefix = "media",
): PublicProductMediaUsageDto {
  const media = requireMedia(usage.mediaId, mediaById);
  const fallbackUsage =
    fallbackSnapshot === undefined
      ? undefined
      : sortedSnapshotMedia(fallbackSnapshot).find(
          (candidate) => usageKey(candidate) === usageKey(usage),
        );
  const localizedDefaults = media.defaultTranslations.get(locale);
  const defaultDefaults = media.defaultTranslations.get(DEFAULT_LOCALE);
  const fieldPath = (field: string) => `${pathPrefix}.${index}.${field}`;
  const alt = resolvedUsageText(
    [
      usage.alt,
      localizedDefaults?.alt,
      fallbackUsage?.alt,
      defaultDefaults?.alt,
    ],
    fieldPath("alt"),
    fallbackFields,
  );
  const title = resolvedUsageText(
    [
      usage.title,
      localizedDefaults?.title,
      fallbackUsage?.title,
      defaultDefaults?.title,
    ],
    fieldPath("title"),
    fallbackFields,
  );
  const caption = resolvedUsageText(
    [
      usage.caption,
      localizedDefaults?.caption,
      fallbackUsage?.caption,
      defaultDefaults?.caption,
    ],
    fieldPath("caption"),
    fallbackFields,
  );
  const poster =
    media.posterMediaId !== undefined
      ? publicMedia(requireMedia(media.posterMediaId, mediaById), storageProvider)
      : media.generatedPoster === undefined
        ? undefined
        : {
            label: media.generatedPoster.label,
            url: storageProvider.getPublicUrl(media.generatedPoster.storage.key),
            mimeType: media.generatedPoster.mimeType,
            sizeBytes: media.generatedPoster.sizeBytes,
            ...(media.generatedPoster.width === undefined
              ? {}
              : { width: media.generatedPoster.width }),
            ...(media.generatedPoster.height === undefined
              ? {}
              : { height: media.generatedPoster.height }),
            ...(media.generatedPoster.codec === undefined
              ? {}
              : { codec: media.generatedPoster.codec }),
          };
  return {
    ...publicMedia(media, storageProvider),
    role: usage.role,
    order: usage.order,
    ...(usage.locale === undefined
      ? {}
      : { locale: usage.locale as LocaleCode }),
    ...(media.durationSeconds === undefined
      ? {}
      : { durationSeconds: media.durationSeconds }),
    ...(poster === undefined ? {} : { poster }),
    ...(alt === undefined ? {} : { alt }),
    ...(title === undefined ? {} : { title }),
    ...(caption === undefined ? {} : { caption }),
  };
}

function fallbackSnapshot(
  context: PublicProductContext,
  locale: LocaleCode,
  catalog: CategoryCatalog,
): PublishedProductLocale | undefined {
  if (locale === DEFAULT_LOCALE) return undefined;
  return coherentProductContext(context.product, DEFAULT_LOCALE, catalog)
    ?.localized;
}

function summaryMediaIds(
  contexts: readonly PublicProductContext[],
  locale: LocaleCode,
): Set<string> {
  return new Set(
    contexts.flatMap((context) => {
      const primary = primaryMediaUsage(context, locale);
      return primary === undefined ? [] : [primary.mediaId.toString()];
    }),
  );
}

function buildSummary(
  context: PublicProductContext,
  locale: LocaleCode,
  catalog: CategoryCatalog,
  mediaById: ReadonlyMap<string, MediaDocument>,
  storageProvider: StorageProvider,
  includePrimaryMedia = true,
): PublicProductSummaryDto {
  const fallbackFields = new Set<string>();
  const fallback = fallbackSnapshot(context, locale, catalog);
  const primary = includePrimaryMedia
    ? primaryMediaUsage(context, locale)
    : undefined;
  const primaryMedia =
    primary === undefined
      ? undefined
      : mapMediaUsage(
          primary,
          0,
          locale,
          fallback,
          mediaById,
          storageProvider,
          fallbackFields,
          "primaryMedia",
        );
  return {
    id: context.product._id.toString(),
    slug: context.global.data.slug,
    name: context.localized.data.name,
    shortDescription: context.localized.data.shortDescription,
    ...(context.global.data.model === undefined
      ? {}
      : { model: context.global.data.model }),
    ...(context.global.data.series === undefined
      ? {}
      : { series: context.global.data.series }),
    category: publicCategory(context, locale, catalog),
    pageTemplate: context.global.data.pageTemplate,
    featured: context.global.data.featured,
    publicationRevision: context.localized.publicationRevision,
    updatedAt: publicUpdatedAt(context),
    availableLocales: availableLocales(context.product, catalog),
    ...(primaryMedia === undefined ? {} : { primaryMedia }),
    fallbackFields: [...fallbackFields].sort(),
  };
}

function visibleCategoryIds(
  locale: LocaleCode,
  catalog: CategoryCatalog,
  categorySlug?: string,
): Types.ObjectId[] {
  const visible = new Set(
    catalog.documents
      .filter(
        (category) =>
          coherentCategoryChain(category, locale, catalog.byId) !== undefined,
      )
      .map((category) => category._id.toString()),
  );
  if (categorySlug === undefined) {
    return catalog.documents
      .filter((category) => visible.has(category._id.toString()))
      .map((category) => category._id);
  }
  const root = catalog.documents.find(
    (category) =>
      visible.has(category._id.toString()) &&
      category.publishedGlobal?.data.slug === categorySlug,
  );
  if (root === undefined) return [];
  const included = new Set([root._id.toString()]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of catalog.documents) {
      const id = category._id.toString();
      const parentId = category.publishedGlobal?.data.parentId?.toString();
      if (
        visible.has(id) &&
        parentId !== undefined &&
        included.has(parentId) &&
        !included.has(id)
      ) {
        included.add(id);
        changed = true;
      }
    }
  }
  return catalog.documents
    .filter((category) => included.has(category._id.toString()))
    .map((category) => category._id);
}

function visibleProductFilter(
  locale: LocaleCode,
  categoryIds: readonly Types.ObjectId[],
  featured?: boolean,
): QueryFilter<Product> {
  return {
    status: "published",
    publishedGlobal: { $exists: true },
    [`publishedSnapshots.${locale}`]: { $exists: true },
    "publishedGlobal.data.categoryId": { $in: categoryIds },
    $expr: {
      $eq: [
        `$publishedSnapshots.${locale}.globalRevision`,
        "$publishedGlobal.globalRevision",
      ],
    },
    ...(featured === undefined
      ? {}
      : { "publishedGlobal.data.featured": featured }),
  } as QueryFilter<Product>;
}

function publicProductSort(
  query: PublicProductListQuery,
): Record<string, SortOrder> {
  switch (query.sort) {
    case "order-desc":
      return { "publishedGlobal.data.displayOrder": -1, _id: 1 };
    case "name-asc":
      return { [`publishedSnapshots.${query.locale}.data.name`]: 1, _id: 1 };
    case "name-desc":
      return { [`publishedSnapshots.${query.locale}.data.name`]: -1, _id: 1 };
    case "updated-desc":
      return { [`publishedSnapshots.${query.locale}.publishedAt`]: -1, _id: 1 };
    case "order-asc":
      return { "publishedGlobal.data.displayOrder": 1, _id: 1 };
  }
}

export async function listPublicProducts(
  query: PublicProductListQuery,
  storageProvider: StorageProvider,
): Promise<PublicProductListDto> {
  const language = await requireLanguage(query.locale);
  const catalog = await loadCategoryCatalog();
  const categoryIds = visibleCategoryIds(
    query.locale,
    catalog,
    query.category,
  );
  if (categoryIds.length === 0) {
    return {
      items: [],
      pagination: {
        page: query.page,
        limit: query.limit,
        total: 0,
        totalPages: 0,
      },
    };
  }
  const filter = visibleProductFilter(
    query.locale,
    categoryIds,
    query.featured,
  );
  const offset = (query.page - 1) * query.limit;
  let findQuery = ProductModel.find(filter)
    .sort(publicProductSort(query))
    .skip(offset)
    .limit(query.limit);
  if (query.sort === "name-asc" || query.sort === "name-desc") {
    findQuery = findQuery.collation({
      locale: language.languageTag,
      strength: 1,
    });
  }
  const [products, total] = await Promise.all([
    findQuery,
    ProductModel.countDocuments(filter),
  ]);
  const contexts = products.map((product) => {
    const context = coherentProductContext(product, query.locale, catalog);
    if (context === undefined) throw snapshotError();
    return context;
  });
  const mediaById = await loadMedia(summaryMediaIds(contexts, query.locale));
  return {
    items: contexts.map((context) =>
      buildSummary(
        context,
        query.locale,
        catalog,
        mediaById,
        storageProvider,
      ),
    ),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

async function requireVisibleProduct(
  slug: string,
  locale: LocaleCode,
  catalog: CategoryCatalog,
): Promise<PublicProductContext> {
  const product = await ProductModel.findOne({
    status: "published",
    "publishedGlobal.data.slug": slug,
  });
  if (product === null) throw productNotFound();
  const context = coherentProductContext(product, locale, catalog);
  if (context === undefined) throw productNotFound();
  return context;
}

export async function getPublicProductVisibility(
  slug: string,
  locale: LocaleCode,
): Promise<PublicProductVisibilityDto> {
  await requireLanguage(locale);
  const catalog = await loadCategoryCatalog();
  const context = await requireVisibleProduct(slug, locale, catalog);
  return {
    slug: context.global.data.slug,
    locale,
    publicationRevision: context.localized.publicationRevision,
    updatedAt: publicUpdatedAt(context),
    availableLocales: availableLocales(context.product, catalog),
  };
}

function composeSpecifications(
  context: PublicProductContext,
): PublicProductDetailDto["specifications"] {
  const localizedGroups = new Map(
    context.localized.data.specifications.map((group) => [group.key, group]),
  );
  return [...context.global.data.specifications]
    .sort((left, right) =>
      left.order === right.order
        ? left.key.localeCompare(right.key)
        : left.order - right.order,
    )
    .map((globalGroup) => {
      const localizedGroup = localizedGroups.get(globalGroup.key);
      if (localizedGroup === undefined) throw snapshotError();
      const localizedItems = new Map(
        localizedGroup.items.map((item) => [item.key, item]),
      );
      return {
        key: globalGroup.key,
        label: localizedGroup.label,
        order: globalGroup.order,
        items: [...globalGroup.items]
          .sort((left, right) =>
            left.order === right.order
              ? left.key.localeCompare(right.key)
              : left.order - right.order,
          )
          .map((globalItem) => {
            const localizedItem = localizedItems.get(globalItem.key);
            if (localizedItem === undefined) throw snapshotError();
            return {
              key: globalItem.key,
              label: localizedItem.label,
              order: globalItem.order,
              value: localizedItem.valueOverride ?? globalItem.value,
              ...(globalItem.unit === undefined
                ? {}
                : { unit: globalItem.unit }),
              ...(localizedItem.note === undefined
                ? {}
                : { note: localizedItem.note }),
            };
          }),
      };
    });
}

async function relatedContexts(
  context: PublicProductContext,
  locale: LocaleCode,
  catalog: CategoryCatalog,
): Promise<PublicProductContext[]> {
  const filter = visibleProductFilter(locale, [context.category._id]);
  const products = await ProductModel.find({
    ...filter,
    _id: { $ne: context.product._id },
  })
    .sort({ "publishedGlobal.data.displayOrder": 1, _id: 1 })
    .limit(relatedProductLimit);
  return products.map((product) => {
    const related = coherentProductContext(product, locale, catalog);
    if (related === undefined) throw snapshotError();
    return related;
  });
}

function detailMediaIds(
  context: PublicProductContext,
  locale: LocaleCode,
  fallback: PublishedProductLocale | undefined,
  related: readonly PublicProductContext[],
): Set<string> {
  const ids = new Set<string>();
  for (const usage of sortedLocaleMedia(context, locale)) {
    ids.add(usage.mediaId.toString());
  }
  for (const feature of context.localized.data.features) {
    if (feature.iconMediaId !== undefined) {
      ids.add(feature.iconMediaId.toString());
    }
  }
  if (context.localized.data.seo.openGraphMediaId !== undefined) {
    ids.add(context.localized.data.seo.openGraphMediaId.toString());
  }
  if (fallback?.data.seo.openGraphMediaId !== undefined) {
    ids.add(fallback.data.seo.openGraphMediaId.toString());
  }
  for (const id of summaryMediaIds(related, locale)) ids.add(id);
  return ids;
}

export async function getPublicProductDetail(
  slug: string,
  locale: LocaleCode,
  requiredPublicationRevision: string,
  storageProvider: StorageProvider,
): Promise<PublicProductDetailDto> {
  await requireLanguage(locale);
  const catalog = await loadCategoryCatalog();
  const context = await requireVisibleProduct(slug, locale, catalog);
  if (context.localized.publicationRevision !== requiredPublicationRevision) {
    throw new AppError(
      409,
      "PUBLICATION_REVISION_CHANGED",
      "The published product revision changed. Request visibility again.",
    );
  }
  const fallback = fallbackSnapshot(context, locale, catalog);
  const related = await relatedContexts(context, locale, catalog);
  const mediaById = await loadMedia(
    detailMediaIds(context, locale, fallback, related),
  );
  const summary = buildSummary(
    context,
    locale,
    catalog,
    mediaById,
    storageProvider,
    false,
  );
  const fallbackFields = new Set(summary.fallbackFields);
  const longDescriptionMarkdown = optionalFallback(
    context.localized.data.longDescriptionMarkdown,
    fallback?.data.longDescriptionMarkdown,
    "longDescriptionMarkdown",
    fallbackFields,
  );
  const warrantyInformation = optionalFallback(
    context.localized.data.warrantyInformation,
    fallback?.data.warrantyInformation,
    "warrantyInformation",
    fallbackFields,
  );
  const seoDescription = optionalFallback(
    context.localized.data.seo.description,
    fallback?.data.seo.description,
    "seo.description",
    fallbackFields,
  );
  const openGraphTitle = optionalFallback(
    context.localized.data.seo.openGraphTitle,
    fallback?.data.seo.openGraphTitle,
    "seo.openGraphTitle",
    fallbackFields,
  );
  const openGraphDescription = optionalFallback(
    context.localized.data.seo.openGraphDescription,
    fallback?.data.seo.openGraphDescription,
    "seo.openGraphDescription",
    fallbackFields,
  );
  const openGraphMediaId = optionalFallback(
    context.localized.data.seo.openGraphMediaId,
    fallback?.data.seo.openGraphMediaId,
    "seo.openGraphMedia",
    fallbackFields,
  );
  const media = sortedLocaleMedia(context, locale).map((usage, index) =>
    mapMediaUsage(
      usage,
      index,
      locale,
      fallback,
      mediaById,
      storageProvider,
      fallbackFields,
    ),
  );
  const features = context.localized.data.features.map((feature) => ({
    key: feature.key,
    title: feature.title,
    ...(feature.body === undefined ? {} : { body: feature.body }),
    ...(feature.iconMediaId === undefined
      ? {}
      : {
          iconMedia: publicMedia(
            requireMedia(feature.iconMediaId, mediaById),
            storageProvider,
          ),
        }),
  }));
  const relatedProducts = related.map((item) =>
    buildSummary(item, locale, catalog, mediaById, storageProvider),
  );
  return {
    ...summary,
    ...(longDescriptionMarkdown === undefined
      ? {}
      : { longDescriptionMarkdown }),
    features,
    advantages: context.localized.data.advantages.map((item) => ({
      key: item.key,
      title: item.title,
      ...(item.body === undefined ? {} : { body: item.body }),
    })),
    applications: context.localized.data.applications.map((item) => ({
      key: item.key,
      title: item.title,
      ...(item.body === undefined ? {} : { body: item.body }),
    })),
    ...(warrantyInformation === undefined ? {} : { warrantyInformation }),
    seo: {
      title: context.localized.data.seo.title,
      ...(context.localized.data.seo.focusKeyphrase === undefined
        ? {}
        : { focusKeyphrase: context.localized.data.seo.focusKeyphrase }),
      ...(seoDescription === undefined ? {} : { description: seoDescription }),
      keywords: [...context.localized.data.seo.keywords],
      ...(openGraphTitle === undefined ? {} : { openGraphTitle }),
      ...(openGraphDescription === undefined
        ? {}
        : { openGraphDescription }),
      ...(openGraphMediaId === undefined
        ? {}
        : {
            openGraphMedia: publicMedia(
              requireMedia(openGraphMediaId, mediaById),
              storageProvider,
            ),
          }),
      ...(context.localized.data.seo.canonicalUrlOverride === undefined
        ? {}
        : {
            canonicalUrlOverride:
              context.localized.data.seo.canonicalUrlOverride,
          }),
      ...(context.localized.data.seo.robots === undefined
        ? {}
        : { robots: context.localized.data.seo.robots }),
    },
    specifications: composeSpecifications(context),
    media,
    relatedProducts,
    fallbackFields: [...fallbackFields].sort(),
  };
}

function categoryUpdatedAt(
  category: CategoryDocument,
  locale: LocaleCode,
): string {
  const global = category.publishedGlobal;
  const localized = category.publishedSnapshots.get(locale);
  if (global === undefined || localized === undefined) throw snapshotError();
  return new Date(
    Math.max(global.publishedAt.getTime(), localized.publishedAt.getTime()),
  ).toISOString();
}

export async function listPublicSitemapEntries(
  query: SitemapQuery,
): Promise<PublicSitemapEntriesDto> {
  const catalog = await loadCategoryCatalog();
  const entries: PublicSitemapEntriesDto["items"] = [];
  for (const category of catalog.documents) {
    const locales = [...category.publishedSnapshots.keys()].filter(
      (locale) =>
        isLocaleCode(locale) &&
        coherentCategoryChain(category, locale, catalog.byId) !== undefined &&
        category.publishedSnapshots.get(locale)?.data.seo.robots?.index !== false,
    );
    const slug = category.publishedGlobal?.data.slug;
    if (slug === undefined) continue;
    for (const locale of locales) {
      entries.push({
        kind: "category",
        locale,
        slug,
        path: `/${locale}/products/category/${slug}`,
        updatedAt: categoryUpdatedAt(category, locale),
        availableLocales: locales,
      });
    }
  }
  const products = await ProductModel.find({
    status: "published",
    publishedGlobal: { $exists: true },
  });
  for (const product of products) {
    const locales = availableLocales(product, catalog).filter(
      (locale) => product.publishedSnapshots.get(locale)?.data.seo.robots?.index !== false,
    );
    const slug = product.publishedGlobal?.data.slug;
    if (slug === undefined) continue;
    for (const locale of locales) {
      const context = coherentProductContext(product, locale, catalog);
      if (context === undefined) continue;
      const categorySlug = context.category.publishedGlobal?.data.slug;
      if (categorySlug === undefined) continue;
      entries.push({
        kind: "product",
        locale,
        slug,
        path: `/${locale}/products/${categorySlug}/${slug}`,
        updatedAt: publicUpdatedAt(context),
        availableLocales: locales,
      });
    }
  }
  entries.sort((left, right) => left.path.localeCompare(right.path));
  const total = entries.length;
  const offset = (query.page - 1) * query.limit;
  return {
    items: entries.slice(offset, offset + query.limit),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}
