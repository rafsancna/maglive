import { createHash } from "node:crypto";
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  productSlugSchema,
  productTemplateIdSchema,
  type LocaleCode,
  type ProductPublicationIssue,
  type PublishedProductGlobalData as PublishedProductGlobalDtoData,
  type PublishedProductLocaleData as PublishedProductLocaleDtoData,
} from "@maglive/contracts";
import type {
  Product,
  ProductDocument,
  SpecificationGroup,
  SpecificationItem,
} from "../models/Product.js";

type ProductLike = Pick<
  Product,
  | "slug"
  | "categoryId"
  | "model"
  | "series"
  | "translations"
  | "specifications"
  | "mediaUsages"
  | "pageTemplate"
  | "displayOrder"
  | "featured"
  | "publishedGlobal"
  | "publishedSnapshots"
>;

export type ProductProjectionResult<T> = Readonly<{
  data?: T;
  errors: ProductPublicationIssue[];
  warnings: ProductPublicationIssue[];
}>;

export type ProductPublicationState = Readonly<{
  workingGlobalHash: string;
  workingLocaleHashes: Partial<Record<LocaleCode, string>>;
  sharedState: "draft" | "published" | "changes-pending";
  localeStates: Record<
    LocaleCode,
    "incomplete" | "draft" | "published" | "changes-pending"
  >;
}>;

function issue(
  severity: "error" | "warning",
  path: string,
  code: string,
  message: string,
): ProductPublicationIssue {
  return { severity, path, code, message };
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashCanonicalValue(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function byOrderAndKey<T extends { order: number; key: string }>(
  left: T,
  right: T,
): number {
  return left.order - right.order || left.key.localeCompare(right.key);
}

function validateUniqueOrders(
  groups: readonly SpecificationGroup[],
): ProductPublicationIssue[] {
  const errors: ProductPublicationIssue[] = [];
  const groupOrders = new Set<number>();
  const groupKeys = new Set<string>();
  for (const [groupIndex, group] of groups.entries()) {
    if (groupKeys.has(group.key)) {
      errors.push(
        issue(
          "error",
          `specifications.${groupIndex}.key`,
          "SPECIFICATION_GROUP_KEY_DUPLICATE",
          `Specification group key "${group.key}" is duplicated.`,
        ),
      );
    }
    groupKeys.add(group.key);
    if (groupOrders.has(group.order)) {
      errors.push(
        issue(
          "error",
          `specifications.${groupIndex}.order`,
          "SPECIFICATION_GROUP_ORDER_DUPLICATE",
          `Specification group order ${group.order} is duplicated.`,
        ),
      );
    }
    groupOrders.add(group.order);

    const itemOrders = new Set<number>();
    const itemKeys = new Set<string>();
    for (const [itemIndex, item] of group.items.entries()) {
      if (itemKeys.has(item.key)) {
        errors.push(
          issue(
            "error",
            `specifications.${groupIndex}.items.${itemIndex}.key`,
            "SPECIFICATION_ITEM_KEY_DUPLICATE",
            `Specification item key "${item.key}" is duplicated in group "${group.key}".`,
          ),
        );
      }
      itemKeys.add(item.key);
      if (itemOrders.has(item.order)) {
        errors.push(
          issue(
            "error",
            `specifications.${groupIndex}.items.${itemIndex}.order`,
            "SPECIFICATION_ITEM_ORDER_DUPLICATE",
            `Specification item order ${item.order} is duplicated in group "${group.key}".`,
          ),
        );
      }
      itemOrders.add(item.order);
    }
  }
  return errors;
}

function globalSpecificationItem(item: SpecificationItem) {
  return {
    key: item.key,
    order: item.order,
    value: item.value,
    ...(item.unit === undefined ? {} : { unit: item.unit }),
  };
}

export function buildProductGlobalProjection(
  product: ProductLike,
): ProductProjectionResult<PublishedProductGlobalDtoData> {
  const errors = validateUniqueOrders(product.specifications);
  if (!productSlugSchema.safeParse(product.slug).success) {
    errors.push(
      issue(
        "error",
        "slug",
        "PRODUCT_SLUG_INVALID",
        "Use a non-reserved lowercase ASCII product slug before publication.",
      ),
    );
  }
  const parsedTemplate = productTemplateIdSchema.safeParse(
    String(product.pageTemplate),
  );
  if (!parsedTemplate.success) {
    errors.push(
      issue(
        "error",
        "pageTemplate",
        "PRODUCT_TEMPLATE_UNKNOWN",
        "Select a template from the static product template catalog.",
      ),
    );
  }
  if (errors.length > 0 || !parsedTemplate.success) {
    return { errors, warnings: [] };
  }

  const data: PublishedProductGlobalDtoData = {
    slug: product.slug,
    categoryId: product.categoryId.toString(),
    ...(product.model === undefined ? {} : { model: product.model }),
    ...(product.series === undefined ? {} : { series: product.series }),
    specifications: [...product.specifications]
      .sort(byOrderAndKey)
      .map((group) => ({
        key: group.key,
        order: group.order,
        items: [...group.items]
          .sort(byOrderAndKey)
          .map(globalSpecificationItem),
      })),
    mediaUsages: [...product.mediaUsages]
      .sort(
        (left, right) =>
          left.order - right.order ||
          left.role.localeCompare(right.role) ||
          left.mediaId.toString().localeCompare(right.mediaId.toString()) ||
          (left.locale ?? "").localeCompare(right.locale ?? ""),
      )
      .map((usage) => ({
        mediaId: usage.mediaId.toString(),
        role: usage.role,
        order: usage.order,
        ...(usage.locale === undefined ? {} : { locale: usage.locale as LocaleCode }),
      })),
    pageTemplate: parsedTemplate.data,
    displayOrder: product.displayOrder,
    featured: product.featured,
  };
  return { data, errors, warnings: [] };
}

export function buildProductLocaleProjection(
  product: ProductLike,
  locale: LocaleCode,
): ProductProjectionResult<PublishedProductLocaleDtoData> {
  const errors: ProductPublicationIssue[] = [];
  const warnings: ProductPublicationIssue[] = [];
  const translation = product.translations.get(locale);
  if (translation === undefined) {
    return {
      errors: [
        issue(
          "error",
          `translations.${locale}`,
          "PRODUCT_TRANSLATION_MISSING",
          `Add the ${locale} product translation before publication.`,
        ),
      ],
      warnings,
    };
  }
  if (translation.name.trim().length === 0) {
    errors.push(
      issue(
        "error",
        `translations.${locale}.name`,
        "PRODUCT_NAME_REQUIRED",
        "A localized product name is required.",
      ),
    );
  }
  const shortDescription = translation.shortDescription?.trim();
  if (shortDescription === undefined || shortDescription.length === 0) {
    errors.push(
      issue(
        "error",
        `translations.${locale}.shortDescription`,
        "PRODUCT_SHORT_DESCRIPTION_REQUIRED",
        "A localized short description is required for publication.",
      ),
    );
  }
  if (
    product.pageTemplate === "topcon-premium" &&
    (translation.longDescriptionMarkdown === undefined ||
      translation.longDescriptionMarkdown.trim().length === 0)
  ) {
    errors.push(
      issue(
        "error",
        `translations.${locale}.longDescriptionMarkdown`,
        "TEMPLATE_LONG_DESCRIPTION_REQUIRED",
        "The TOPCon Premium template requires a localized long description.",
      ),
    );
  }

  const specifications = [...product.specifications]
    .sort(byOrderAndKey)
    .map((group, groupIndex) => {
      const groupTranslation = group.translations.get(locale);
      if (groupTranslation === undefined || groupTranslation.label.trim().length === 0) {
        errors.push(
          issue(
            "error",
            `specifications.${groupIndex}.translations.${locale}.label`,
            "SPECIFICATION_GROUP_LABEL_REQUIRED",
            `Add the ${locale} label for specification group "${group.key}".`,
          ),
        );
      }
      return {
        key: group.key,
        label: groupTranslation?.label ?? "",
        items: [...group.items]
          .sort(byOrderAndKey)
          .map((item, itemIndex) => {
            const itemTranslation = item.translations.get(locale);
            if (
              itemTranslation === undefined ||
              itemTranslation.label.trim().length === 0
            ) {
              errors.push(
                issue(
                  "error",
                  `specifications.${groupIndex}.items.${itemIndex}.translations.${locale}.label`,
                  "SPECIFICATION_ITEM_LABEL_REQUIRED",
                  `Add the ${locale} label for specification item "${item.key}".`,
                ),
              );
            }
            return {
              key: item.key,
              label: itemTranslation?.label ?? "",
              ...(itemTranslation?.valueOverride === undefined
                ? {}
                : { valueOverride: itemTranslation.valueOverride }),
              ...(itemTranslation?.note === undefined
                ? {}
                : { note: itemTranslation.note }),
            };
          }),
      };
    });

  const seoTitle = translation.seo.title ?? translation.name.slice(0, 70);
  if (translation.seo.title === undefined) {
    warnings.push(
      issue(
        "warning",
        `translations.${locale}.seo.title`,
        "SEO_TITLE_DERIVED",
        "The SEO title will be derived from the localized product name.",
      ),
    );
  }
  const seoDescription = translation.seo.description ?? shortDescription?.slice(0, 320);
  if (translation.seo.description === undefined) {
    warnings.push(
      issue(
        "warning",
        `translations.${locale}.seo.description`,
        "SEO_DESCRIPTION_DERIVED",
        "The SEO description will be derived from the localized short description.",
      ),
    );
  }

  if (errors.length > 0 || shortDescription === undefined) {
    return { errors, warnings };
  }
  const data: PublishedProductLocaleDtoData = {
    name: translation.name,
    shortDescription,
    ...(translation.longDescriptionMarkdown === undefined
      ? {}
      : { longDescriptionMarkdown: translation.longDescriptionMarkdown }),
    features: translation.features.map((feature) => ({
      key: feature.key,
      title: feature.title,
      ...(feature.body === undefined ? {} : { body: feature.body }),
      ...(feature.iconMediaId === undefined
        ? {}
        : { iconMediaId: feature.iconMediaId.toString() }),
    })),
    advantages: translation.advantages.map((item) => ({
      key: item.key,
      title: item.title,
      ...(item.body === undefined ? {} : { body: item.body }),
    })),
    applications: translation.applications.map((item) => ({
      key: item.key,
      title: item.title,
      ...(item.body === undefined ? {} : { body: item.body }),
    })),
    ...(translation.warrantyInformation === undefined
      ? {}
      : { warrantyInformation: translation.warrantyInformation }),
    seo: {
      title: seoTitle,
      ...(seoDescription === undefined ? {} : { description: seoDescription }),
      keywords: [...(translation.seo.keywords ?? [])],
      ...(translation.seo.openGraphTitle === undefined
        ? {}
        : { openGraphTitle: translation.seo.openGraphTitle }),
      ...(translation.seo.openGraphDescription === undefined
        ? {}
        : { openGraphDescription: translation.seo.openGraphDescription }),
      ...(translation.seo.openGraphMediaId === undefined
        ? {}
        : { openGraphMediaId: translation.seo.openGraphMediaId.toString() }),
    },
    specifications,
    mediaUsages: [...product.mediaUsages]
      .filter((usage) => usage.locale === undefined || usage.locale === locale)
      .sort(
        (left, right) =>
          left.order - right.order ||
          left.role.localeCompare(right.role) ||
          left.mediaId.toString().localeCompare(right.mediaId.toString()),
      )
      .map((usage) => {
        const localized = usage.translations.get(locale);
        return {
          mediaId: usage.mediaId.toString(),
          role: usage.role,
          order: usage.order,
          ...(usage.locale === undefined ? {} : { locale }),
          ...(localized?.alt === undefined ? {} : { alt: localized.alt }),
          ...(localized?.title === undefined ? {} : { title: localized.title }),
          ...(localized?.caption === undefined
            ? {}
            : { caption: localized.caption }),
        };
      }),
  };
  return { data, errors, warnings };
}

export function deriveProductPublicationState(
  product: ProductLike,
  localeCodes: readonly LocaleCode[] = LOCALE_CODES,
): ProductPublicationState {
  const global = buildProductGlobalProjection(product);
  if (global.data === undefined) {
    throw new Error("Cannot derive publication state from invalid shared product data.");
  }
  const workingGlobalHash = hashCanonicalValue(global.data);
  const workingLocaleHashes: Partial<Record<LocaleCode, string>> = {};
  const localeStates = {} as ProductPublicationState["localeStates"];

  for (const locale of localeCodes) {
    const localized = buildProductLocaleProjection(product, locale);
    const snapshot = product.publishedSnapshots.get(locale);
    if (localized.data !== undefined) {
      workingLocaleHashes[locale] = hashCanonicalValue(localized.data);
    }
    if (localized.data === undefined) {
      localeStates[locale] = snapshot === undefined ? "incomplete" : "changes-pending";
    } else if (snapshot === undefined) {
      localeStates[locale] = "draft";
    } else if (
      product.publishedGlobal?.sourceHash === workingGlobalHash &&
      snapshot.globalRevision === product.publishedGlobal.globalRevision &&
      snapshot.sourceHash === workingLocaleHashes[locale]
    ) {
      localeStates[locale] = "published";
    } else {
      localeStates[locale] = "changes-pending";
    }
  }

  return {
    workingGlobalHash,
    workingLocaleHashes,
    sharedState:
      product.publishedGlobal === undefined
        ? "draft"
        : product.publishedGlobal.sourceHash === workingGlobalHash
          ? "published"
          : "changes-pending",
    localeStates,
  };
}

export function validateProductUnpublication(
  product: Pick<Product, "publishedSnapshots">,
  locale?: LocaleCode,
): ProductPublicationIssue[] {
  if (locale !== DEFAULT_LOCALE) return [];
  const hasAdditionalLiveLocale = [...product.publishedSnapshots.keys()].some(
    (candidate) => candidate !== DEFAULT_LOCALE,
  );
  return hasAdditionalLiveLocale
    ? [
        issue(
          "error",
          "locale",
          "DEFAULT_LOCALE_REQUIRED",
          `Unpublish additional locales before ${DEFAULT_LOCALE}.`,
        ),
      ]
    : [];
}

export function publicationStateForDto(
  product: ProductDocument,
  localeCodes: readonly LocaleCode[] = LOCALE_CODES,
) {
  return deriveProductPublicationState(product, localeCodes);
}
