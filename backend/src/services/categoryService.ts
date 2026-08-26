import { createHash, randomUUID } from "node:crypto";
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  type CategoryAdminDto,
  type CategoryListDto,
  type CreateCategoryRequest,
  type LocaleCode,
  type PublicCategoryDto,
  type PublicCategoryTreeDto,
  type PublicCategoryTreeNode,
  type PublishCategoryRequest,
  type ReorderCategoriesRequest,
  type UnpublishCategoryRequest,
  type UpdateCategoryRequest,
} from "@maglive/contracts";
import mongoose, {
  Types,
  type ClientSession,
  type mongo,
} from "mongoose";
import { AppError } from "../errors/AppError.js";
import {
  CategoryModel,
  type CategoryDocument,
  type CategoryImageUsage,
  type CategoryTranslation,
  type PublishedCategoryGlobalData,
  type PublishedCategoryLocaleData,
} from "../models/Category.js";
import { lockReadyCategoryMedia } from "./mediaService.js";

type AdminActor = Readonly<{ id: string }>;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function duplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as mongo.MongoServerError).code === 11000
  );
}

function throwVersionConflict(): never {
  throw new AppError(
    409,
    "VERSION_CONFLICT",
    "This category changed after it was loaded. Refresh and try again.",
  );
}

function assertVersion(category: CategoryDocument, version: number): void {
  if (category.version !== version) {
    throwVersionConflict();
  }
}

async function inTransaction<T>(
  operation: (session: ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession();
  let result: T | undefined;
  try {
    await session.withTransaction(async () => {
      result = await operation(session);
    });
  } finally {
    await session.endSession();
  }
  if (result === undefined) {
    throw new AppError(500, "TRANSACTION_FAILED", "The database transaction did not complete.");
  }
  return result;
}

function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function toTranslation(
  value: NonNullable<CreateCategoryRequest["translations"][LocaleCode]>,
): CategoryTranslation {
  return {
    name: value.name,
    ...(value.description === undefined ? {} : { description: value.description }),
    seo: {
      ...(value.seo.title === undefined ? {} : { title: value.seo.title }),
      ...(value.seo.description === undefined
        ? {}
        : { description: value.seo.description }),
      ...(value.seo.openGraphMediaId === undefined
        ? {}
        : { openGraphMediaId: toObjectId(value.seo.openGraphMediaId) }),
    },
  };
}

function toTranslations(
  values: CreateCategoryRequest["translations"],
): Map<string, CategoryTranslation> {
  return new Map(
    Object.entries(values).map(([locale, translation]) => [
      locale,
      toTranslation(translation),
    ]),
  );
}

function toImageUsage(
  value: NonNullable<CreateCategoryRequest["image"]>,
): CategoryImageUsage {
  return {
    mediaId: toObjectId(value.mediaId),
    translations: new Map(
      Object.entries(value.translations).map(([locale, translation]) => [
        locale,
        {
          ...(translation.alt === undefined ? {} : { alt: translation.alt }),
          ...(translation.title === undefined ? {} : { title: translation.title }),
        },
      ]),
    ),
  };
}

function workingGlobalData(category: CategoryDocument) {
  return {
    slug: category.slug,
    parentId: category.parentId?.toString() ?? null,
    sortOrder: category.sortOrder,
    ...(category.image === undefined
      ? {}
      : { imageMediaId: category.image.mediaId.toString() }),
  };
}

function workingLocaleData(
  category: CategoryDocument,
  locale: LocaleCode,
): PublishedCategoryLocaleData | undefined {
  const translation = category.translations.get(locale);
  if (translation === undefined) {
    return undefined;
  }
  const imageTranslation = category.image?.translations.get(locale);
  if (category.image !== undefined && imageTranslation?.alt === undefined) {
    return undefined;
  }
  const description =
    translation.seo.description ??
    (translation.description === undefined
      ? undefined
      : translation.description.slice(0, 320));
  return {
    name: translation.name,
    ...(translation.description === undefined
      ? {}
      : { description: translation.description }),
    seo: {
      title: translation.seo.title ?? translation.name.slice(0, 70),
      ...(description === undefined ? {} : { description }),
      ...(translation.seo.openGraphMediaId === undefined
        ? {}
        : { openGraphMediaId: translation.seo.openGraphMediaId }),
    },
    ...(imageTranslation?.alt === undefined
      ? {}
      : {
          image: {
            alt: imageTranslation.alt,
            ...(imageTranslation.title === undefined
              ? {}
              : { title: imageTranslation.title }),
          },
        }),
  };
}

function workingMediaIds(category: CategoryDocument): string[] {
  const ids = new Set<string>();
  if (category.image !== undefined) {
    ids.add(category.image.mediaId.toString());
  }
  for (const locale of LOCALE_CODES) {
    const openGraphMediaId = category.translations
      .get(locale)
      ?.seo.openGraphMediaId?.toString();
    if (openGraphMediaId !== undefined) ids.add(openGraphMediaId);
  }
  return [...ids];
}

function publishedGlobalToDto(category: CategoryDocument) {
  const snapshot = category.publishedGlobal;
  if (snapshot === undefined) {
    return undefined;
  }
  return {
    sourceVersion: snapshot.sourceVersion,
    sourceHash: snapshot.sourceHash,
    globalRevision: snapshot.globalRevision,
    publishedAt: snapshot.publishedAt.toISOString(),
    data: {
      slug: snapshot.data.slug,
      parentId: snapshot.data.parentId?.toString() ?? null,
      sortOrder: snapshot.data.sortOrder,
      ...(snapshot.data.imageMediaId === undefined
        ? {}
        : { imageMediaId: snapshot.data.imageMediaId.toString() }),
    },
  };
}

function publishedLocaleToDto(snapshot: NonNullable<CategoryDocument["publishedSnapshots"]> extends Map<string, infer Value> ? Value : never) {
  return {
    sourceVersion: snapshot.sourceVersion,
    sourceHash: snapshot.sourceHash,
    globalRevision: snapshot.globalRevision,
    publicationRevision: snapshot.publicationRevision,
    publishedAt: snapshot.publishedAt.toISOString(),
    data: {
      name: snapshot.data.name,
      ...(snapshot.data.description === undefined
        ? {}
        : { description: snapshot.data.description }),
      seo: {
        title: snapshot.data.seo.title,
        ...(snapshot.data.seo.description === undefined
          ? {}
          : { description: snapshot.data.seo.description }),
        ...(snapshot.data.seo.openGraphMediaId === undefined
          ? {}
          : {
              openGraphMediaId:
                snapshot.data.seo.openGraphMediaId.toString(),
            }),
      },
      ...(snapshot.data.image === undefined
        ? {}
        : {
            image: {
              alt: snapshot.data.image.alt,
              ...(snapshot.data.image.title === undefined
                ? {}
                : { title: snapshot.data.image.title }),
            },
          }),
    },
  };
}

export function toCategoryAdminDto(category: CategoryDocument): CategoryAdminDto {
  const globalHash = hashValue(workingGlobalData(category));
  const translations = Object.fromEntries(
    [...category.translations.entries()].map(([locale, translation]) => [
      locale,
      {
        name: translation.name,
        ...(translation.description === undefined
          ? {}
          : { description: translation.description }),
        seo: {
          ...(translation.seo.title === undefined
            ? {}
            : { title: translation.seo.title }),
          ...(translation.seo.description === undefined
            ? {}
            : { description: translation.seo.description }),
          ...(translation.seo.openGraphMediaId === undefined
            ? {}
            : {
                openGraphMediaId:
                  translation.seo.openGraphMediaId.toString(),
              }),
        },
      },
    ]),
  );
  const image =
    category.image === undefined
      ? undefined
      : {
          mediaId: category.image.mediaId.toString(),
          translations: Object.fromEntries(
            [...category.image.translations.entries()].map(
              ([locale, translation]) => [
                locale,
                {
                  ...(translation.alt === undefined
                    ? {}
                    : { alt: translation.alt }),
                  ...(translation.title === undefined
                    ? {}
                    : { title: translation.title }),
                },
              ],
            ),
          ),
        };
  const workingLocaleHashes: Partial<Record<LocaleCode, string>> = {};
  const publishedSnapshots: Partial<
    CategoryAdminDto["publishedSnapshots"]
  > = {};
  const localeStates = {} as Record<
    LocaleCode,
    CategoryAdminDto["localeStates"][LocaleCode]
  >;

  for (const locale of LOCALE_CODES) {
    const working = workingLocaleData(category, locale);
    const snapshot = category.publishedSnapshots.get(locale);
    if (working !== undefined) {
      workingLocaleHashes[locale] = hashValue(working);
    }
    if (snapshot !== undefined) {
      publishedSnapshots[locale] = publishedLocaleToDto(snapshot);
    }
    if (working === undefined) {
      localeStates[locale] = "incomplete";
    } else if (snapshot === undefined) {
      localeStates[locale] = "draft";
    } else if (
      snapshot.sourceHash === hashValue(working) &&
      category.publishedGlobal?.sourceHash === globalHash
    ) {
      localeStates[locale] = "published";
    } else {
      localeStates[locale] = "changes-pending";
    }
  }

  return {
    id: category._id.toString(),
    slug: category.slug,
    parentId: category.parentId?.toString() ?? null,
    sortOrder: category.sortOrder,
    translations,
    ...(image === undefined ? {} : { image }),
    status: category.status,
    ...(category.publishedGlobal === undefined
      ? {}
      : { publishedGlobal: publishedGlobalToDto(category) }),
    publishedSnapshots,
    workingGlobalHash: globalHash,
    workingLocaleHashes,
    localeStates,
    ...(category.firstPublishedAt === undefined
      ? {}
      : { firstPublishedAt: category.firstPublishedAt.toISOString() }),
    createdBy: category.createdBy.toString(),
    updatedBy: category.updatedBy.toString(),
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    version: category.version,
  };
}

async function requireCategory(
  id: string,
  session?: ClientSession,
): Promise<CategoryDocument> {
  const query = CategoryModel.findOne({ _id: id, status: { $ne: "deleting" } });
  if (session !== undefined) {
    query.session(session);
  }
  const category = await query;
  if (category === null) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "The category was not found.");
  }
  return category;
}

async function validateParent(
  category: CategoryDocument | undefined,
  parentId: Types.ObjectId | null,
  session: ClientSession,
): Promise<void> {
  if (parentId === null) {
    return;
  }
  if (category !== undefined && category._id.equals(parentId)) {
    throw new AppError(422, "CATEGORY_CYCLE", "A category cannot be its own parent.");
  }
  const parent = await CategoryModel.findOne({
    _id: parentId,
    status: "active",
  }).session(session);
  if (parent === null) {
    throw new AppError(422, "INVALID_PARENT", "Select an active root category.");
  }
  if (parent.parentId !== null) {
    throw new AppError(
      422,
      "CATEGORY_DEPTH_EXCEEDED",
      "Categories support a root and one child level.",
    );
  }
  if (category !== undefined) {
    const childExists = await CategoryModel.exists({
      parentId: category._id,
      status: { $ne: "deleting" },
    }).session(session);
    if (childExists !== null) {
      throw new AppError(
        422,
        "CATEGORY_DEPTH_EXCEEDED",
        "A category with children cannot be moved below another category.",
      );
    }
  }
}

function assertCategoryActive(category: CategoryDocument): void {
  if (category.status !== "active") {
    throw new AppError(
      409,
      "CATEGORY_NOT_ACTIVE",
      "Only active categories can be changed or published.",
    );
  }
}

export async function listAdminCategories(): Promise<CategoryListDto> {
  const categories = await CategoryModel.find({ status: { $ne: "deleting" } }).sort({
    parentId: 1,
    sortOrder: 1,
    _id: 1,
  });
  return { categories: categories.map(toCategoryAdminDto) };
}

export async function getAdminCategory(id: string): Promise<CategoryAdminDto> {
  return toCategoryAdminDto(await requireCategory(id));
}

export async function createCategory(
  input: CreateCategoryRequest,
  actor: AdminActor,
): Promise<CategoryAdminDto> {
  try {
    return await inTransaction(async (session) => {
      const parentId = input.parentId === null ? null : toObjectId(input.parentId);
      await validateParent(undefined, parentId, session);
      const category = new CategoryModel({
        slug: input.slug,
        parentId,
        sortOrder: input.sortOrder,
        translations: toTranslations(input.translations),
        ...(input.image === undefined ? {} : { image: toImageUsage(input.image) }),
        status: "active",
        publishedSnapshots: new Map(),
        createdBy: toObjectId(actor.id),
        updatedBy: toObjectId(actor.id),
      });
      await lockReadyCategoryMedia(workingMediaIds(category), session);
      await category.save({ session });
      return toCategoryAdminDto(category);
    });
  } catch (error) {
    if (duplicateKeyError(error)) {
      throw new AppError(409, "CATEGORY_SLUG_EXISTS", "That category slug is already in use.");
    }
    throw error;
  }
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryRequest,
  actor: AdminActor,
): Promise<CategoryAdminDto> {
  try {
    return await inTransaction(async (session) => {
      const category = await requireCategory(id, session);
      assertCategoryActive(category);
      assertVersion(category, input.version);
      if (
        input.slug !== undefined &&
        category.publishedGlobal !== undefined &&
        input.slug !== category.slug
      ) {
        throw new AppError(
          409,
          "PUBLISHED_SLUG_IMMUTABLE",
          "A category slug cannot change after its first publication.",
        );
      }
      const nextParentId =
        input.parentId === undefined
          ? category.parentId
          : input.parentId === null
            ? null
            : toObjectId(input.parentId);
      await validateParent(category, nextParentId, session);

      if (input.slug !== undefined) category.slug = input.slug;
      if (input.parentId !== undefined) category.parentId = nextParentId;
      if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
      if (input.translations !== undefined) {
        category.translations = toTranslations(input.translations);
      }
      if (input.image === null) {
        category.set("image", undefined);
      } else if (input.image !== undefined) {
        category.image = toImageUsage(input.image);
      }
      category.updatedBy = toObjectId(actor.id);
      await lockReadyCategoryMedia(workingMediaIds(category), session);
      await category.save({ session });
      return toCategoryAdminDto(category);
    });
  } catch (error) {
    if (duplicateKeyError(error)) {
      throw new AppError(409, "CATEGORY_SLUG_EXISTS", "That category slug is already in use.");
    }
    if (error instanceof mongoose.Error.VersionError) {
      throwVersionConflict();
    }
    throw error;
  }
}

function sameMembers(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

async function assertParentPublished(
  category: CategoryDocument,
  locale: LocaleCode,
  session: ClientSession,
): Promise<void> {
  if (category.parentId === null) {
    return;
  }
  const parent = await CategoryModel.findOne({
    _id: category.parentId,
    status: "active",
  }).session(session);
  const parentSnapshot = parent?.publishedSnapshots.get(locale);
  if (
    parent?.publishedGlobal === undefined ||
    parentSnapshot === undefined ||
    parentSnapshot.globalRevision !== parent.publishedGlobal.globalRevision
  ) {
    throw new AppError(
      409,
      "PARENT_LOCALE_NOT_PUBLISHED",
      `Publish the parent category in ${locale} before publishing this category.`,
    );
  }
}

export async function publishCategory(
  id: string,
  input: PublishCategoryRequest,
  actor: AdminActor,
): Promise<CategoryAdminDto> {
  return inTransaction(async (session) => {
    const category = await requireCategory(id, session);
    assertCategoryActive(category);
    assertVersion(category, input.version);

    const requested = new Set(input.locales);
    const live = new Set<LocaleCode>(
      LOCALE_CODES.filter((locale) => category.publishedSnapshots.has(locale)),
    );
    if (category.publishedGlobal === undefined && !requested.has(DEFAULT_LOCALE)) {
      throw new AppError(
        409,
        "DEFAULT_LOCALE_REQUIRED",
        `Publish ${DEFAULT_LOCALE} before any additional locale.`,
      );
    }
    const globalData = workingGlobalData(category);
    const globalHash = hashValue(globalData);
    const sharedChanged =
      category.publishedGlobal === undefined ||
      category.publishedGlobal.sourceHash !== globalHash;
    const promotionLocales = new Set<LocaleCode>([...live, ...requested]);
    if (
      category.publishedGlobal !== undefined &&
      sharedChanged &&
      (!input.promoteShared || !sameMembers(requested, promotionLocales))
    ) {
      throw new AppError(
        409,
        "SHARED_PROMOTION_REQUIRED",
        "Shared category fields changed. Confirm publication for every live locale.",
      );
    }
    const localesToWrite = sharedChanged ? [...promotionLocales] : [...requested];
    const localeData = new Map<LocaleCode, PublishedCategoryLocaleData>();
    for (const locale of localesToWrite) {
      const data = workingLocaleData(category, locale);
      if (data === undefined) {
        throw new AppError(
          422,
          "LOCALE_INCOMPLETE",
          `The ${locale} translation is incomplete. A name and localized image alt text are required.`,
        );
      }
      await assertParentPublished(category, locale, session);
      localeData.set(locale, data);
    }

    const publishedAt = new Date();
    const globalRevision = sharedChanged
      ? randomUUID()
      : category.publishedGlobal?.globalRevision;
    if (globalRevision === undefined) {
      throw new AppError(500, "PUBLICATION_FAILED", "A publication revision could not be created.");
    }
    if (sharedChanged) {
      const storedGlobal: PublishedCategoryGlobalData = {
        slug: category.slug,
        parentId: category.parentId,
        sortOrder: category.sortOrder,
        ...(category.image === undefined
          ? {}
          : { imageMediaId: category.image.mediaId }),
      };
      category.publishedGlobal = {
        sourceVersion: category.version,
        sourceHash: globalHash,
        globalRevision,
        publishedAt,
        data: storedGlobal,
      };
    }
    for (const locale of localesToWrite) {
      const data = localeData.get(locale);
      if (data === undefined) continue;
      category.publishedSnapshots.set(locale, {
        sourceVersion: category.version,
        sourceHash: hashValue(data),
        globalRevision,
        publicationRevision: randomUUID(),
        publishedAt,
        data,
      });
    }
    category.firstPublishedAt ??= publishedAt;
    category.updatedBy = toObjectId(actor.id);
    await category.save({ session });
    return toCategoryAdminDto(category);
  });
}

export async function unpublishCategory(
  id: string,
  input: UnpublishCategoryRequest,
  actor: AdminActor,
): Promise<CategoryAdminDto> {
  return inTransaction(async (session) => {
    const category = await requireCategory(id, session);
    assertVersion(category, input.version);
    const locales =
      input.locale === undefined
        ? [...category.publishedSnapshots.keys()]
        : [input.locale];
    if (
      input.locale === DEFAULT_LOCALE &&
      [...category.publishedSnapshots.keys()].some(
        (locale) => locale !== DEFAULT_LOCALE,
      )
    ) {
      throw new AppError(
        409,
        "DEFAULT_LOCALE_REQUIRED",
        `Unpublish additional locales before ${DEFAULT_LOCALE}.`,
      );
    }
    for (const locale of locales) {
      const publishedChild = await CategoryModel.exists({
        parentId: category._id,
        status: { $ne: "deleting" },
        [`publishedSnapshots.${locale}`]: { $exists: true },
      }).session(session);
      if (publishedChild !== null) {
        throw new AppError(
          409,
          "PUBLISHED_CHILD_EXISTS",
          `Unpublish child categories in ${locale} first.`,
        );
      }
    }
    for (const locale of locales) {
      category.publishedSnapshots.delete(locale);
    }
    if (category.publishedSnapshots.size === 0) {
      category.set("publishedGlobal", undefined);
    }
    category.updatedBy = toObjectId(actor.id);
    await category.save({ session });
    return toCategoryAdminDto(category);
  });
}

export async function archiveCategory(
  id: string,
  version: number,
  actor: AdminActor,
): Promise<CategoryAdminDto> {
  return inTransaction(async (session) => {
    const category = await requireCategory(id, session);
    assertVersion(category, version);
    category.status = "archived";
    category.updatedBy = toObjectId(actor.id);
    await category.save({ session });
    return toCategoryAdminDto(category);
  });
}

export async function deleteCategory(id: string, version: number): Promise<void> {
  await inTransaction(async (session) => {
    const category = await requireCategory(id, session);
    assertVersion(category, version);
    if (category.firstPublishedAt !== undefined) {
      throw new AppError(
        409,
        "PUBLISHED_CATEGORY_DELETE_DENIED",
        "Published categories must be archived instead of permanently deleted.",
      );
    }
    category.status = "deleting";
    await category.save({ session });
    return true;
  });

  const result = await inTransaction(async (session) => {
    const category = await CategoryModel.findOne({ _id: id, status: "deleting" }).session(
      session,
    );
    if (category === null) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "The category was not found.");
    }
    const childExists = await CategoryModel.exists({
      parentId: category._id,
      status: { $ne: "deleting" },
    }).session(session);
    if (childExists !== null) {
      category.status = "active";
      await category.save({ session });
      return "blocked" as const;
    }
    await CategoryModel.deleteOne({ _id: category._id }).session(session);
    return "deleted" as const;
  });
  if (result === "blocked") {
    throw new AppError(
      409,
      "CATEGORY_IN_USE",
      "Move or remove child categories before deleting this category.",
    );
  }
}

export async function reorderCategories(
  input: ReorderCategoriesRequest,
  actor: AdminActor,
): Promise<CategoryListDto> {
  await inTransaction(async (session) => {
    const parentId = input.parentId === null ? null : toObjectId(input.parentId);
    const siblings = await CategoryModel.find({
      parentId,
      status: { $ne: "deleting" },
    })
      .select({ _id: 1, version: 1 })
      .session(session);
    const expected = new Set(siblings.map((category) => category._id.toString()));
    const received = new Set(input.categories.map((category) => category.id));
    if (!sameMembers(expected, received)) {
      throw new AppError(
        409,
        "REORDER_SET_CHANGED",
        "The sibling set changed. Refresh before reordering.",
      );
    }
    const versions = new Map(
      siblings.map((category) => [category._id.toString(), category.version]),
    );
    for (const item of input.categories) {
      if (versions.get(item.id) !== item.version) {
        throwVersionConflict();
      }
    }
    const result = await CategoryModel.bulkWrite(
      input.categories.map((item, index) => ({
        updateOne: {
          filter: { _id: item.id, version: item.version },
          update: {
            $set: { sortOrder: index, updatedBy: toObjectId(actor.id) },
            $inc: { version: 1 },
          },
        },
      })),
      { session },
    );
    if (result.matchedCount !== input.categories.length) {
      throwVersionConflict();
    }
    return true;
  });
  return listAdminCategories();
}

function coherentSnapshot(
  category: CategoryDocument,
  locale: LocaleCode,
): boolean {
  const localeSnapshot = category.publishedSnapshots.get(locale);
  return (
    category.status === "active" &&
    category.publishedGlobal !== undefined &&
    localeSnapshot !== undefined &&
    localeSnapshot.globalRevision ===
      category.publishedGlobal.globalRevision
  );
}

function coherentChain(
  category: CategoryDocument,
  locale: LocaleCode,
  byId: ReadonlyMap<string, CategoryDocument>,
): CategoryDocument[] | undefined {
  if (!coherentSnapshot(category, locale)) {
    return undefined;
  }
  const chain = [category];
  const seen = new Set([category._id.toString()]);
  let parentId = category.publishedGlobal?.data.parentId ?? null;
  while (parentId !== null) {
    const id = parentId.toString();
    if (seen.has(id)) return undefined;
    seen.add(id);
    const parent = byId.get(id);
    if (parent === undefined || !coherentSnapshot(parent, locale)) {
      return undefined;
    }
    chain.unshift(parent);
    parentId = parent.publishedGlobal?.data.parentId ?? null;
  }
  return chain;
}

function toPublicDto(
  category: CategoryDocument,
  locale: LocaleCode,
  byId: ReadonlyMap<string, CategoryDocument>,
): PublicCategoryDto | undefined {
  const chain = coherentChain(category, locale, byId);
  const global = category.publishedGlobal;
  const localized = category.publishedSnapshots.get(locale);
  if (chain === undefined || global === undefined || localized === undefined) {
    return undefined;
  }
  const availableLocales = LOCALE_CODES.filter(
    (candidate) => coherentChain(category, candidate, byId) !== undefined,
  );
  return {
    id: category._id.toString(),
    slug: global.data.slug,
    name: localized.data.name,
    ...(localized.data.description === undefined
      ? {}
      : { description: localized.data.description }),
    parentId: global.data.parentId?.toString() ?? null,
    sortOrder: global.data.sortOrder,
    seo: {
      title: localized.data.seo.title,
      ...(localized.data.seo.description === undefined
        ? {}
        : { description: localized.data.seo.description }),
      ...(localized.data.seo.openGraphMediaId === undefined
        ? {}
        : {
            openGraphMediaId:
              localized.data.seo.openGraphMediaId.toString(),
          }),
    },
    ...(global.data.imageMediaId === undefined ||
    localized.data.image === undefined
      ? {}
      : {
          image: {
            mediaId: global.data.imageMediaId.toString(),
            alt: localized.data.image.alt,
            ...(localized.data.image.title === undefined
              ? {}
              : { title: localized.data.image.title }),
          },
        }),
    availableLocales,
    breadcrumbs: chain.map((item) => {
      const itemGlobal = item.publishedGlobal;
      const itemLocale = item.publishedSnapshots.get(locale);
      if (itemGlobal === undefined || itemLocale === undefined) {
        throw new AppError(500, "CATEGORY_SNAPSHOT_INVALID", "A category snapshot is inconsistent.");
      }
      return { slug: itemGlobal.data.slug, name: itemLocale.data.name };
    }),
  };
}

async function publicCategoryDocuments(): Promise<CategoryDocument[]> {
  return CategoryModel.find({
    status: "active",
    publishedGlobal: { $exists: true },
  }).sort({
    "publishedGlobal.data.sortOrder": 1,
    _id: 1,
  });
}

export async function getPublicCategoryTree(
  locale: LocaleCode,
): Promise<PublicCategoryTreeDto> {
  const documents = await publicCategoryDocuments();
  const byId = new Map(
    documents.map((category) => [category._id.toString(), category]),
  );
  const dtoById = new Map<string, PublicCategoryTreeNode>();
  for (const category of documents) {
    const dto = toPublicDto(category, locale, byId);
    if (dto !== undefined) {
      dtoById.set(category._id.toString(), { ...dto, children: [] });
    }
  }
  const roots: PublicCategoryTreeNode[] = [];
  for (const node of dtoById.values()) {
    if (node.parentId === null) {
      roots.push(node);
    } else {
      dtoById.get(node.parentId)?.children.push(node);
    }
  }
  const sortNodes = (nodes: PublicCategoryTreeNode[]): void => {
    nodes.sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug),
    );
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(roots);
  return { categories: roots };
}

export async function getPublicCategory(
  slug: string,
  locale: LocaleCode,
): Promise<PublicCategoryDto> {
  const documents = await publicCategoryDocuments();
  const byId = new Map(
    documents.map((category) => [category._id.toString(), category]),
  );
  const category = documents.find(
    (candidate) => candidate.publishedGlobal?.data.slug === slug,
  );
  const dto =
    category === undefined ? undefined : toPublicDto(category, locale, byId);
  if (dto === undefined) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "The category was not found.");
  }
  return dto;
}
