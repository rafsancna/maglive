import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  getLocaleMetadata,
  type AdminProductListDto,
  type AdminProductListItem,
  type AdminProductListQuery,
  type LocaleCode,
} from "@maglive/contracts";
import type { QueryFilter, SortOrder } from "mongoose";
import {
  buildProductLocaleProjection,
  deriveProductPublicationState,
} from "../domain/productPublication.js";
import {
  ProductModel,
  productLocaleSnapshotMatchesGlobal,
  type Product,
  type ProductDocument,
} from "../models/Product.js";

type CollectionCountRow = Readonly<{
  _id: "draft" | "published" | "archived";
  count: number;
  featured: number;
}>;

function escapedExpression(value: string): RegExp {
  return new RegExp(value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&"), "i");
}

function productFilter(query: AdminProductListQuery): QueryFilter<Product> {
  const filter: QueryFilter<Product> = {
    status: query.status ?? { $ne: "deleting" },
  };
  if (query.categoryId !== undefined) filter.categoryId = query.categoryId;
  if (query.featured !== undefined) filter.featured = query.featured;
  if (query.search !== undefined) {
    const expression = escapedExpression(query.search);
    filter.$or = [
      { slug: expression },
      { model: expression },
      { series: expression },
      ...LOCALE_CODES.map((locale) => ({
        [`translations.${locale}.name`]: expression,
      })),
    ];
  }
  return filter;
}

function productSort(
  query: AdminProductListQuery,
): Record<string, SortOrder> {
  switch (query.sort) {
    case "updated-asc":
      return { updatedAt: 1, _id: 1 };
    case "order-asc":
      return { displayOrder: 1, _id: 1 };
    case "order-desc":
      return { displayOrder: -1, _id: 1 };
    case "name-asc":
      return { [`translations.${query.locale}.name`]: 1, _id: 1 };
    case "name-desc":
      return { [`translations.${query.locale}.name`]: -1, _id: 1 };
    case "updated-desc":
      return { updatedAt: -1, _id: 1 };
  }
}

function translationCompleteness(
  product: ProductDocument,
  locale: LocaleCode,
): AdminProductListItem["translationCompleteness"][LocaleCode] {
  const translation = product.translations.get(locale);
  const localizedSpecificationGroups = product.specifications.filter(
    (group) =>
      group.translations.get(locale)?.label.trim().length !== 0 &&
      group.translations.has(locale) &&
      group.items.every(
        (item) =>
          item.translations.has(locale) &&
          item.translations.get(locale)?.label.trim().length !== 0,
      ),
  ).length;
  return {
    hasTranslation: translation !== undefined,
    hasName: (translation?.name.trim().length ?? 0) > 0,
    hasShortDescription:
      (translation?.shortDescription?.trim().length ?? 0) > 0,
    hasLongDescription:
      (translation?.longDescriptionMarkdown?.trim().length ?? 0) > 0,
    localizedSpecificationGroups,
    requiredSpecificationGroups: product.specifications.length,
    complete:
      buildProductLocaleProjection(product, locale).data !== undefined,
  };
}

function adminProductListItem(
  product: ProductDocument,
  requestedLocale: LocaleCode,
): AdminProductListItem {
  const publicationState = deriveProductPublicationState(product);
  const names: Partial<Record<LocaleCode, string>> = {};
  const completeness = {} as AdminProductListItem["translationCompleteness"];
  for (const locale of LOCALE_CODES) {
    const name = product.translations.get(locale)?.name;
    if (name !== undefined) names[locale] = name;
    completeness[locale] = translationCompleteness(product, locale);
  }
  const requestedName = names[requestedLocale];
  const defaultName = names[DEFAULT_LOCALE];
  const name = requestedName ?? defaultName ?? product.slug;
  const nameLocale =
    requestedName !== undefined
      ? requestedLocale
      : defaultName !== undefined
        ? DEFAULT_LOCALE
        : undefined;
  const publishedLocales = LOCALE_CODES.filter((locale) =>
    productLocaleSnapshotMatchesGlobal(product, locale),
  );
  if (product.status === "deleting") {
    throw new Error("Deleting products cannot appear in administrator lists.");
  }
  return {
    id: product._id.toString(),
    slug: product.slug,
    name,
    ...(nameLocale === undefined ? {} : { nameLocale }),
    names,
    ...(product.model === undefined ? {} : { model: product.model }),
    ...(product.series === undefined ? {} : { series: product.series }),
    categoryId: product.categoryId.toString(),
    pageTemplate: product.pageTemplate,
    displayOrder: product.displayOrder,
    featured: product.featured,
    status: product.status,
    sharedState: publicationState.sharedState,
    localeStates: publicationState.localeStates,
    translationCompleteness: completeness,
    publishedLocales,
    canDeletePermanently:
      product.status === "draft" &&
      product.firstPublishedAt === undefined &&
      product.publishedGlobal === undefined &&
      product.publishedSnapshots.size === 0,
    updatedAt: product.updatedAt.toISOString(),
    version: product.version,
  };
}

async function collectionCounts(): Promise<
  AdminProductListDto["collectionCounts"]
> {
  const rows = await ProductModel.aggregate<CollectionCountRow>([
    { $match: { status: { $ne: "deleting" } } },
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        featured: { $sum: { $cond: ["$featured", 1, 0] } },
      },
    },
  ]);
  const counts = {
    all: 0,
    draft: 0,
    published: 0,
    archived: 0,
    featured: 0,
  };
  for (const row of rows) {
    counts[row._id] = row.count;
    counts.all += row.count;
    counts.featured += row.featured;
  }
  return counts;
}

function withNameCollation<T extends { collation(value: object): T }>(
  databaseQuery: T,
  query: AdminProductListQuery,
): T {
  if (query.sort !== "name-asc" && query.sort !== "name-desc") {
    return databaseQuery;
  }
  return databaseQuery.collation({
    locale: getLocaleMetadata(query.locale).languageTag,
    strength: 1,
  });
}

async function localeStatePage(
  filter: QueryFilter<Product>,
  query: AdminProductListQuery,
): Promise<{ items: AdminProductListItem[]; total: number }> {
  const offset = (query.page - 1) * query.limit;
  const items: AdminProductListItem[] = [];
  let total = 0;
  const findQuery = withNameCollation(
    ProductModel.find(filter).sort(productSort(query)),
    query,
  );
  for await (const product of findQuery.cursor()) {
    const state = deriveProductPublicationState(product).localeStates[
      query.locale
    ];
    if (state !== query.localeState) continue;
    if (total >= offset && items.length < query.limit) {
      items.push(adminProductListItem(product, query.locale));
    }
    total += 1;
  }
  return { items, total };
}

export async function listAdminProducts(
  query: AdminProductListQuery,
): Promise<AdminProductListDto> {
  const filter = productFilter(query);
  const countsPromise = collectionCounts();
  let items: AdminProductListItem[];
  let total: number;
  if (query.localeState === undefined) {
    const offset = (query.page - 1) * query.limit;
    const findQuery = withNameCollation(
      ProductModel.find(filter)
        .sort(productSort(query))
        .skip(offset)
        .limit(query.limit),
      query,
    );
    const [products, matchedCount] = await Promise.all([
      findQuery,
      ProductModel.countDocuments(filter),
    ]);
    items = products.map((product) =>
      adminProductListItem(product, query.locale),
    );
    total = matchedCount;
  } else {
    ({ items, total } = await localeStatePage(filter, query));
  }
  return {
    items,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
    collectionCounts: await countsPromise,
  };
}

export const productQueryInternals = {
  escapedExpression,
  productFilter,
  productSort,
};
