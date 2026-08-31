import { randomUUID } from "node:crypto";
import {
  DEFAULT_LOCALE,
  type FieldError,
  type LocaleCode,
  type ProductAdminDto,
  type ProductMediaRole,
  type ProductPublicationIssue,
  type ProductPublicationValidationResult,
  type PublishedProductGlobalData as PublishedProductGlobalDtoData,
  type PublishedProductLocaleData as PublishedProductLocaleDtoData,
  type PublishProductRequest,
} from "@maglive/contracts";
import mongoose, { Types, type ClientSession } from "mongoose";
import {
  buildProductGlobalProjection,
  buildProductLocaleProjection,
  hashCanonicalValue,
} from "../domain/productPublication.js";
import { AppError } from "../errors/AppError.js";
import { assertLanguagesExist, listLanguageCodes } from "./languageService.js";
import { CategoryModel, type CategoryDocument } from "../models/Category.js";
import { MediaModel, type MediaDocument } from "../models/Media.js";
import {
  ProductModel,
  toProductAdminDto,
  type ProductDocument,
  type PublishedProductGlobalData,
  type PublishedProductLocaleData,
} from "../models/Product.js";
import { lockProductPublicationReferences } from "./productReferenceService.js";

type AdminActor = Readonly<{ id: string }>;

type PublicationAnalysis = Readonly<{
  report: ProductPublicationValidationResult;
  sharedChanged: boolean;
  effectiveLocales: LocaleCode[];
  globalData?: PublishedProductGlobalDtoData;
  globalHash?: string;
  localeData: Map<LocaleCode, PublishedProductLocaleDtoData>;
}>;

type ExpectedMediaKind = "image" | "video" | "document";

type MediaReference = Readonly<{
  id: string;
  path: string;
  expectedKind: ExpectedMediaKind;
  locale?: LocaleCode;
  requiresAlt?: boolean;
}>;

function issue(
  severity: "error" | "warning",
  path: string,
  code: string,
  message: string,
): ProductPublicationIssue {
  return { severity, path, code, message };
}

function compareIssues(
  left: ProductPublicationIssue,
  right: ProductPublicationIssue,
): number {
  return (
    left.path.localeCompare(right.path) ||
    left.code.localeCompare(right.code) ||
    left.message.localeCompare(right.message)
  );
}

function reportFor(
  errors: ProductPublicationIssue[],
  warnings: ProductPublicationIssue[],
): ProductPublicationValidationResult {
  return {
    publishable: errors.length === 0,
    errors: errors
      .filter((item): item is ProductPublicationIssue & { severity: "error" } =>
        item.severity === "error",
      )
      .sort(compareIssues),
    warnings: warnings
      .filter(
        (item): item is ProductPublicationIssue & { severity: "warning" } =>
          item.severity === "warning",
      )
      .sort(compareIssues),
  };
}

function sameMembers(
  left: ReadonlySet<LocaleCode>,
  right: ReadonlySet<LocaleCode>,
): boolean {
  return left.size === right.size && [...left].every((item) => right.has(item));
}

function mediaKindForRole(role: ProductMediaRole): ExpectedMediaKind {
  if (role === "video" || role === "backgroundVideo") return "video";
  if (
    role === "datasheet" ||
    role === "certificate" ||
    role === "brochure" ||
    role === "document"
  ) {
    return "document";
  }
  return "image";
}

function coherentCategoryLocale(
  category: CategoryDocument,
  locale: LocaleCode,
): boolean {
  const snapshot = category.publishedSnapshots.get(locale);
  return (
    category.publishedGlobal !== undefined &&
    snapshot !== undefined &&
    snapshot.globalRevision === category.publishedGlobal.globalRevision
  );
}

async function validateCategory(
  product: ProductDocument,
  locales: readonly LocaleCode[],
  session: ClientSession,
): Promise<ProductPublicationIssue[]> {
  const errors: ProductPublicationIssue[] = [];
  const category = await CategoryModel.findById(product.categoryId).session(session);
  if (category === null || category.status === "deleting") {
    return [
      issue(
        "error",
        "categoryId",
        "PRODUCT_CATEGORY_NOT_FOUND",
        "Select an existing category before publication.",
      ),
    ];
  }
  if (category.status !== "active") {
    errors.push(
      issue(
        "error",
        "categoryId",
        "PRODUCT_CATEGORY_INACTIVE",
        "Products can only be published in an active category.",
      ),
    );
  }
  const childExists = await CategoryModel.exists({
    parentId: category._id,
    status: { $ne: "deleting" },
  }).session(session);
  if (childExists !== null) {
    errors.push(
      issue(
        "error",
        "categoryId",
        "PRODUCT_CATEGORY_NOT_LEAF",
        "Assign the product to a leaf category before publication.",
      ),
    );
  }

  let parent: CategoryDocument | null = null;
  if (category.parentId !== null) {
    parent = await CategoryModel.findById(category.parentId).session(session);
    if (parent === null || parent.status === "deleting") {
      errors.push(
        issue(
          "error",
          "categoryId",
          "PRODUCT_CATEGORY_ANCESTOR_MISSING",
          "The selected category has a missing ancestor.",
        ),
      );
    } else if (parent.status !== "active") {
      errors.push(
        issue(
          "error",
          "categoryId",
          "PRODUCT_CATEGORY_ANCESTOR_INACTIVE",
          "Every category ancestor must be active before product publication.",
        ),
      );
    }
  }

  for (const locale of locales) {
    if (!coherentCategoryLocale(category, locale)) {
      errors.push(
        issue(
          "error",
          "categoryId",
          "PRODUCT_CATEGORY_LOCALE_UNPUBLISHED",
          `Publish the selected category in ${locale} before publishing this product.`,
        ),
      );
    }
    if (parent !== null && !coherentCategoryLocale(parent, locale)) {
      errors.push(
        issue(
          "error",
          "categoryId",
          "PRODUCT_CATEGORY_ANCESTOR_LOCALE_UNPUBLISHED",
          `Publish every category ancestor in ${locale} before publishing this product.`,
        ),
      );
    }
  }
  return errors;
}

function workingMediaReferences(
  product: ProductDocument,
  locales: readonly LocaleCode[],
  validateAllSharedUsages: boolean,
): MediaReference[] {
  const references: MediaReference[] = [];
  const localeSet = new Set(locales);
  for (const [index, usage] of product.mediaUsages.entries()) {
    if (
      !validateAllSharedUsages &&
      usage.locale !== undefined &&
      !localeSet.has(usage.locale as LocaleCode)
    ) {
      continue;
    }
    references.push({
      id: usage.mediaId.toString(),
      path: `mediaUsages.${index}.mediaId`,
      expectedKind: mediaKindForRole(usage.role),
      ...(usage.locale === undefined
        ? {}
        : { locale: usage.locale as LocaleCode }),
      ...(mediaKindForRole(usage.role) === "image" ? { requiresAlt: true } : {}),
    });
  }
  for (const locale of locales) {
    const translation = product.translations.get(locale);
    if (translation === undefined) continue;
    for (const [index, feature] of translation.features.entries()) {
      if (feature.iconMediaId !== undefined) {
        references.push({
          id: feature.iconMediaId.toString(),
          path: `translations.${locale}.features.${index}.iconMediaId`,
          expectedKind: "image",
          locale,
        });
      }
    }
    if (translation.seo.openGraphMediaId !== undefined) {
      references.push({
        id: translation.seo.openGraphMediaId.toString(),
        path: `translations.${locale}.seo.openGraphMediaId`,
        expectedKind: "image",
        locale,
      });
    }
  }
  return references;
}

function usageAlt(
  product: ProductDocument,
  reference: MediaReference,
  media: MediaDocument,
  locale: LocaleCode,
): string | undefined {
  const indexMatch = /^mediaUsages\.(\d+)\.mediaId$/.exec(reference.path);
  if (indexMatch === null) return undefined;
  const index = Number(indexMatch[1]);
  return (
    product.mediaUsages[index]?.translations.get(locale)?.alt ??
    media.defaultTranslations.get(locale)?.alt
  );
}

async function validateMedia(
  product: ProductDocument,
  locales: readonly LocaleCode[],
  validateAllSharedUsages: boolean,
  session: ClientSession,
): Promise<{
  errors: ProductPublicationIssue[];
  warnings: ProductPublicationIssue[];
}> {
  const errors: ProductPublicationIssue[] = [];
  const warnings: ProductPublicationIssue[] = [];
  const references = workingMediaReferences(
    product,
    locales,
    validateAllSharedUsages,
  );
  const ids = [...new Set(references.map((reference) => reference.id))];
  const mediaDocuments = await MediaModel.find({ _id: { $in: ids } }).session(
    session,
  );
  const mediaById = new Map(
    mediaDocuments.map((media) => [media._id.toString(), media]),
  );

  for (const reference of references) {
    const media = mediaById.get(reference.id);
    if (media === undefined) {
      errors.push(
        issue(
          "error",
          reference.path,
          "PRODUCT_MEDIA_NOT_FOUND",
          "The referenced media record does not exist.",
        ),
      );
      continue;
    }
    if (media.status !== "ready") {
      errors.push(
        issue(
          "error",
          reference.path,
          "PRODUCT_MEDIA_NOT_READY",
          "Referenced media must be ready before publication.",
        ),
      );
    }
    if (media.kind !== reference.expectedKind) {
      errors.push(
        issue(
          "error",
          reference.path,
          "PRODUCT_MEDIA_ROLE_TYPE_MISMATCH",
          `This usage requires ${reference.expectedKind} media, not ${media.kind} media.`,
        ),
      );
    }
    if (reference.expectedKind === "document" && media.mimeType !== "application/pdf") {
      errors.push(
        issue(
          "error",
          reference.path,
          "PRODUCT_DOCUMENT_PDF_REQUIRED",
          "Product document roles only accept validated PDF media.",
        ),
      );
    }
    if (reference.expectedKind === "video") {
      if (media.posterMediaId === undefined && media.generatedPoster === undefined) {
        errors.push(
          issue(
            "error",
            reference.path,
            "PRODUCT_VIDEO_POSTER_REQUIRED",
            "Published product videos require a ready image poster.",
          ),
        );
      } else if (media.posterMediaId !== undefined) {
        const poster =
          mediaById.get(media.posterMediaId.toString()) ??
          (await MediaModel.findById(media.posterMediaId).session(session));
        if (poster === null || poster.status !== "ready" || poster.kind !== "image") {
          errors.push(
            issue(
              "error",
              reference.path,
              "PRODUCT_VIDEO_POSTER_NOT_READY",
              "The video poster must reference a ready image.",
            ),
          );
        }
      }
    }
    if (reference.requiresAlt === true) {
      for (const locale of locales) {
        if (
          (reference.locale === undefined || reference.locale === locale) &&
          usageAlt(product, reference, media, locale) === undefined
        ) {
          warnings.push(
            issue(
              "warning",
              `${reference.path.replace(/\.mediaId$/, "")}.translations.${locale}.alt`,
              "PRODUCT_MEDIA_ALT_MISSING",
              `Add contextual ${locale} alternative text for this image.`,
            ),
          );
        }
      }
    }
  }
  return { errors, warnings };
}

async function analyzeProductPublication(
  product: ProductDocument,
  input: Pick<PublishProductRequest, "locales" | "promoteShared">,
  session: ClientSession,
): Promise<PublicationAnalysis> {
  await assertLanguagesExist(input.locales);
  const localeCodes = await listLanguageCodes();
  const errors: ProductPublicationIssue[] = [];
  const warnings: ProductPublicationIssue[] = [];
  if (product.status === "archived" || product.status === "deleting") {
    errors.push(
      issue(
        "error",
        "status",
        "PRODUCT_STATUS_NOT_PUBLISHABLE",
        "Restore this product to draft before publication.",
      ),
    );
  }
  const requested = new Set(input.locales);
  if (requested.size !== input.locales.length) {
    errors.push(
      issue(
        "error",
        "locales",
        "PRODUCT_PUBLICATION_LOCALES_DUPLICATE",
        "Each publication locale can only be requested once.",
      ),
    );
  }
  const live = new Set<LocaleCode>(
    localeCodes.filter((locale) => product.publishedSnapshots.has(locale)),
  );
  if (product.publishedGlobal === undefined && !requested.has(DEFAULT_LOCALE)) {
    errors.push(
      issue(
        "error",
        "locales",
        "DEFAULT_LOCALE_REQUIRED",
        `Publish ${DEFAULT_LOCALE} before any additional locale.`,
      ),
    );
  }
  if (
    product.publishedGlobal !== undefined &&
    !product.publishedSnapshots.has(DEFAULT_LOCALE)
  ) {
    errors.push(
      issue(
        "error",
        "publishedSnapshots",
        "DEFAULT_LOCALE_RETENTION_REQUIRED",
        `A published product must retain its ${DEFAULT_LOCALE} snapshot.`,
      ),
    );
  }
  if (
    product.publishedGlobal !== undefined &&
    product.slug !== product.publishedGlobal.data.slug
  ) {
    errors.push(
      issue(
        "error",
        "slug",
        "PRODUCT_SLUG_LOCKED",
        "A product slug cannot change after its first publication.",
      ),
    );
  }

  const globalProjection = buildProductGlobalProjection(product);
  errors.push(...globalProjection.errors);
  warnings.push(...globalProjection.warnings);
  const globalHash =
    globalProjection.data === undefined
      ? undefined
      : hashCanonicalValue(globalProjection.data);
  const sharedChanged =
    product.publishedGlobal === undefined ||
    globalHash === undefined ||
    product.publishedGlobal.sourceHash !== globalHash;
  const promotionLocales = new Set<LocaleCode>([...live, ...requested]);
  if (
    product.publishedGlobal !== undefined &&
    sharedChanged &&
    (!input.promoteShared || !sameMembers(requested, promotionLocales))
  ) {
    errors.push(
      issue(
        "error",
        "promoteShared",
        "SHARED_PROMOTION_REQUIRED",
        "Shared product fields changed. Confirm publication for every live locale.",
      ),
    );
  }
  const effectiveLocales = [
    ...(sharedChanged ? promotionLocales : requested),
  ].sort((left, right) => localeCodes.indexOf(left) - localeCodes.indexOf(right));
  const localeData = new Map<LocaleCode, PublishedProductLocaleDtoData>();
  for (const locale of effectiveLocales) {
    const projection = buildProductLocaleProjection(product, locale);
    errors.push(...projection.errors);
    warnings.push(...projection.warnings);
    if (projection.data !== undefined) localeData.set(locale, projection.data);
  }
  errors.push(...(await validateCategory(product, effectiveLocales, session)));
  const media = await validateMedia(
    product,
    effectiveLocales,
    sharedChanged,
    session,
  );
  errors.push(...media.errors);
  warnings.push(...media.warnings);

  return {
    report: reportFor(errors, warnings),
    sharedChanged,
    effectiveLocales,
    ...(globalProjection.data === undefined
      ? {}
      : { globalData: globalProjection.data }),
    ...(globalHash === undefined ? {} : { globalHash }),
    localeData,
  };
}

export async function validateProductPublication(
  product: ProductDocument,
  locales: readonly LocaleCode[],
  promoteShared: boolean,
  session: ClientSession,
): Promise<ProductPublicationValidationResult> {
  return (
    await analyzeProductPublication(
      product,
      { locales: [...locales], promoteShared },
      session,
    )
  ).report;
}

function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function storedGlobalData(
  data: PublishedProductGlobalDtoData,
): PublishedProductGlobalData {
  return {
    slug: data.slug,
    categoryId: toObjectId(data.categoryId),
    ...(data.model === undefined ? {} : { model: data.model }),
    ...(data.series === undefined ? {} : { series: data.series }),
    specifications: data.specifications.map((group) => ({
      key: group.key,
      order: group.order,
      items: group.items.map((item) => ({
        key: item.key,
        order: item.order,
        value: item.value,
        ...(item.unit === undefined ? {} : { unit: item.unit }),
      })),
    })),
    mediaUsages: data.mediaUsages.map((usage) => ({
      mediaId: toObjectId(usage.mediaId),
      role: usage.role,
      order: usage.order,
      ...(usage.locale === undefined ? {} : { locale: usage.locale }),
    })),
    pageTemplate: data.pageTemplate,
    displayOrder: data.displayOrder,
    featured: data.featured,
  };
}

function storedLocaleData(
  data: PublishedProductLocaleDtoData,
): PublishedProductLocaleData {
  return {
    name: data.name,
    shortDescription: data.shortDescription,
    ...(data.longDescriptionMarkdown === undefined
      ? {}
      : { longDescriptionMarkdown: data.longDescriptionMarkdown }),
    features: data.features.map((feature) => ({
      key: feature.key,
      title: feature.title,
      ...(feature.body === undefined ? {} : { body: feature.body }),
      ...(feature.iconMediaId === undefined
        ? {}
        : { iconMediaId: toObjectId(feature.iconMediaId) }),
    })),
    advantages: data.advantages.map((item) => ({
      key: item.key,
      title: item.title,
      ...(item.body === undefined ? {} : { body: item.body }),
    })),
    applications: data.applications.map((item) => ({
      key: item.key,
      title: item.title,
      ...(item.body === undefined ? {} : { body: item.body }),
    })),
    ...(data.warrantyInformation === undefined
      ? {}
      : { warrantyInformation: data.warrantyInformation }),
    seo: {
      title: data.seo.title,
      ...(data.seo.focusKeyphrase === undefined
        ? {}
        : { focusKeyphrase: data.seo.focusKeyphrase }),
      ...(data.seo.description === undefined
        ? {}
        : { description: data.seo.description }),
      keywords: [...data.seo.keywords],
      ...(data.seo.openGraphTitle === undefined
        ? {}
        : { openGraphTitle: data.seo.openGraphTitle }),
      ...(data.seo.openGraphDescription === undefined
        ? {}
        : { openGraphDescription: data.seo.openGraphDescription }),
      ...(data.seo.openGraphMediaId === undefined
        ? {}
        : { openGraphMediaId: toObjectId(data.seo.openGraphMediaId) }),
      ...(data.seo.canonicalUrlOverride === undefined
        ? {}
        : { canonicalUrlOverride: data.seo.canonicalUrlOverride }),
      ...(data.seo.robots === undefined ? {} : { robots: data.seo.robots }),
    },
    specifications: data.specifications.map((group) => ({
      key: group.key,
      label: group.label,
      items: group.items.map((item) => ({
        key: item.key,
        label: item.label,
        ...(item.valueOverride === undefined
          ? {}
          : { valueOverride: item.valueOverride }),
        ...(item.note === undefined ? {} : { note: item.note }),
      })),
    })),
    mediaUsages: data.mediaUsages.map((usage) => ({
      mediaId: toObjectId(usage.mediaId),
      role: usage.role,
      order: usage.order,
      ...(usage.locale === undefined ? {} : { locale: usage.locale }),
      ...(usage.alt === undefined ? {} : { alt: usage.alt }),
      ...(usage.title === undefined ? {} : { title: usage.title }),
      ...(usage.caption === undefined ? {} : { caption: usage.caption }),
    })),
  };
}

async function requireProduct(
  id: string,
  session: ClientSession,
): Promise<ProductDocument> {
  const product = await ProductModel.findOne({
    _id: id,
    status: { $ne: "deleting" },
  }).session(session);
  if (product === null) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "The product was not found.");
  }
  return product;
}

function validationDetails(
  issues: readonly ProductPublicationIssue[],
): FieldError[] {
  return issues.map(({ path, code, message }) => ({ path, code, message }));
}

export async function publishProduct(
  id: string,
  input: PublishProductRequest,
  actor: AdminActor,
): Promise<{
  product: ProductAdminDto;
  validation: ProductPublicationValidationResult;
}> {
  const session = await mongoose.startSession();
  let result:
    | {
        product: ProductAdminDto;
        validation: ProductPublicationValidationResult;
      }
    | undefined;
  try {
    await session.withTransaction(async () => {
      const product = await requireProduct(id, session);
      if (product.version !== input.version) {
        throw new AppError(
          409,
          "VERSION_CONFLICT",
          "This product changed after it was loaded. Refresh and try again.",
        );
      }
      const analysis = await analyzeProductPublication(product, input, session);
      if (!analysis.report.publishable) {
        throw new AppError(
          422,
          "PRODUCT_NOT_PUBLISHABLE",
          "Resolve the product publication errors and try again.",
          validationDetails(analysis.report.errors),
        );
      }
      if (analysis.globalData === undefined || analysis.globalHash === undefined) {
        throw new AppError(
          500,
          "PRODUCT_PUBLICATION_FAILED",
          "The shared product snapshot could not be generated.",
        );
      }
      await lockProductPublicationReferences(product, session);

      const publishedAt = new Date();
      const globalRevision = analysis.sharedChanged
        ? randomUUID()
        : product.publishedGlobal?.globalRevision;
      if (globalRevision === undefined) {
        throw new AppError(
          500,
          "PRODUCT_PUBLICATION_FAILED",
          "The shared product revision could not be generated.",
        );
      }
      if (analysis.sharedChanged) {
        product.publishedGlobal = {
          sourceVersion: product.version,
          sourceHash: analysis.globalHash,
          globalRevision,
          publishedAt,
          data: storedGlobalData(analysis.globalData),
        };
      }
      for (const locale of analysis.effectiveLocales) {
        const data = analysis.localeData.get(locale);
        if (data === undefined) {
          throw new AppError(
            500,
            "PRODUCT_PUBLICATION_FAILED",
            `The ${locale} product snapshot could not be generated.`,
          );
        }
        product.publishedSnapshots.set(locale, {
          sourceVersion: product.version,
          sourceHash: hashCanonicalValue(data),
          globalRevision,
          publicationRevision: randomUUID(),
          publishedAt,
          data: storedLocaleData(data),
        });
      }
      product.status = "published";
      product.firstPublishedAt ??= publishedAt;
      product.updatedBy = toObjectId(actor.id);
      await product.save({ session });
      result = {
        product: toProductAdminDto(product, await listLanguageCodes()),
        validation: analysis.report,
      };
    });
  } finally {
    await session.endSession();
  }
  if (result === undefined) {
    throw new AppError(
      500,
      "TRANSACTION_FAILED",
      "The product publication transaction did not complete.",
    );
  }
  return result;
}
