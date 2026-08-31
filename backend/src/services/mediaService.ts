import {
  type AdminMediaDto,
  type MediaListDto,
  type MediaUsageDto,
  type MediaUsagesDto,
  type ProductMediaRole,
  type SafeAdminDto,
  type UpdateMediaRequest,
  type mediaListQuerySchema,
} from "@maglive/contracts";
import type { Request } from "express";
import mongoose, { Types, type ClientSession } from "mongoose";
import type { z } from "zod";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import {
  inspectMediaFile,
  type InspectedMedia,
} from "../media/mediaInspection.js";
import {
  receiveMediaUpload,
  removeReceivedUpload,
} from "../media/receiveMediaUpload.js";
import { CategoryModel, type CategoryDocument } from "../models/Category.js";
import {
  MediaModel,
  type MediaDocument,
  type MediaTranslation,
} from "../models/Media.js";
import { NavigationConfigModel } from "../models/NavigationConfig.js";
import { ProductModel, type ProductDocument } from "../models/Product.js";
import type { StorageProvider } from "../storage/StorageProvider.js";
import type { MediaJobQueue } from "../media/mediaQueue.js";
import { assertLanguagesExist, listLanguageCodes } from "./languageService.js";

type MediaListQuery = z.output<typeof mediaListQuerySchema>;

function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function assertVersion(media: MediaDocument, version: number): void {
  if (media.version !== version) {
    throw new AppError(
      409,
      "VERSION_CONFLICT",
      "This media record changed after it was loaded. Refresh and try again.",
    );
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

function mediaTranslations(
  values: UpdateMediaRequest["defaultTranslations"],
): Map<string, MediaTranslation> {
  return new Map(
    Object.entries(values ?? {}).flatMap(([locale, translation]) =>
      translation === undefined
        ? []
        : [[
            locale,
            {
              ...(translation.title === undefined
                ? {}
                : { title: translation.title }),
              ...(translation.alt === undefined ? {} : { alt: translation.alt }),
              ...(translation.caption === undefined
                ? {}
                : { caption: translation.caption }),
            },
          ] as const],
    ),
  );
}

export function toAdminMediaDto(
  media: MediaDocument,
  storageProvider: StorageProvider,
): AdminMediaDto {
  if (media.storage !== undefined && media.storage.provider !== storageProvider.id) {
    throw new AppError(
      503,
      "STORAGE_PROVIDER_UNAVAILABLE",
      "The media storage provider is unavailable.",
    );
  }
  return {
    id: media._id.toString(),
    kind: media.kind,
    ...(media.storage === undefined
      ? {}
      : { url: storageProvider.getPublicUrl(media.storage.key) }),
    mimeType: media.mimeType,
    ...(media.width === undefined ? {} : { width: media.width }),
    ...(media.height === undefined ? {} : { height: media.height }),
    originalName: media.originalName,
    sizeBytes: media.sizeBytes,
    checksum: media.checksum,
    ...(media.durationSeconds === undefined
      ? {}
      : { durationSeconds: media.durationSeconds }),
    ...(media.posterMediaId === undefined
      ? {}
      : { posterMediaId: media.posterMediaId.toString() }),
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
    ...(media.generatedPoster === undefined
      ? {}
      : {
          generatedPoster: {
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
          },
        }),
    defaultTranslations: Object.fromEntries(media.defaultTranslations),
    status: media.status,
    progress: media.progress ?? (media.status === "ready" ? 100 : 0),
    ...(media.processingStage === undefined
      ? {}
      : { processingStage: media.processingStage }),
    originalSizeBytes: media.originalSizeBytes ?? media.sizeBytes,
    ...(media.optimizedSizeBytes === undefined
      ? {}
      : { optimizedSizeBytes: media.optimizedSizeBytes }),
    ...(media.processingError === undefined
      ? {}
      : { processingError: media.processingError }),
    processingAttempts: media.processingAttempts ?? 0,
    uploadedBy: media.uploadedBy.toString(),
    createdAt: media.createdAt.toISOString(),
    updatedAt: media.updatedAt.toISOString(),
    version: media.version,
  };
}

async function requireMedia(
  id: string,
  session?: ClientSession,
): Promise<MediaDocument> {
  const query = MediaModel.findById(id);
  if (session !== undefined) query.session(session);
  const media = await query;
  if (media === null) {
    throw new AppError(404, "MEDIA_NOT_FOUND", "The media record was not found.");
  }
  return media;
}

function escapedExpression(value: string): RegExp {
  return new RegExp(value.replace(/[|\\{}()[\]^$+*?.-]/g, "\\$&"), "i");
}

export async function listMedia(
  query: MediaListQuery,
  storageProvider: StorageProvider,
): Promise<MediaListDto> {
  const filter: Record<string, unknown> = {};
  if (query.kind !== undefined) filter.kind = query.kind;
  if (query.status !== undefined) {
    filter.status = query.status;
  } else {
    filter.status = { $ne: "deleting" };
  }
  if (query.search !== undefined && query.search !== "") {
    filter.originalName = escapedExpression(query.search);
  }
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    MediaModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(query.limit),
    MediaModel.countDocuments(filter),
  ]);
  return {
    items: items.map((media) => toAdminMediaDto(media, storageProvider)),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
}

export async function getMedia(
  id: string,
  storageProvider: StorageProvider,
): Promise<AdminMediaDto> {
  return toAdminMediaDto(await requireMedia(id), storageProvider);
}

function assertStoredSize(
  inspected: InspectedMedia,
  sizeBytes: number,
  config: AppConfig,
): void {
  const maximum =
    inspected.kind === "image"
      ? config.maxImageBytes
      : inspected.kind === "video"
        ? config.maxVideoBytes
        : config.maxDocumentBytes;
  if (sizeBytes > maximum) {
    throw new AppError(
      413,
      "MEDIA_TOO_LARGE",
      "The uploaded file exceeds its configured size limit.",
    );
  }
}

export async function uploadMedia(
  request: Request,
  actor: SafeAdminDto,
  config: AppConfig,
  storageProvider: StorageProvider,
  mediaQueue?: MediaJobQueue,
): Promise<AdminMediaDto> {
  const received = await receiveMediaUpload(request, config);
  let storedKey: string | undefined;
  try {
    const inspected = await inspectMediaFile(
      received.temporaryPath,
      received.claimedMimeType,
      received.originalName,
    );
    assertStoredSize(inspected, received.sizeBytes, config);
    const requiresProcessing =
      mediaQueue !== undefined &&
      (inspected.kind === "image" || inspected.kind === "video");
    const stored = await storageProvider.save({
      temporaryPath: received.temporaryPath,
      kind: inspected.kind,
      extension: inspected.extension,
      visibility: requiresProcessing ? "private" : "public",
    });
    storedKey = stored.key;
    const media = new MediaModel({
      kind: inspected.kind,
      ...(requiresProcessing
        ? { sourceStorage: { provider: stored.provider, key: stored.key } }
        : { storage: { provider: stored.provider, key: stored.key } }),
      originalName: received.originalName,
      mimeType: inspected.mimeType,
      sizeBytes: stored.sizeBytes,
      originalSizeBytes: stored.sizeBytes,
      checksum: received.checksum,
      ...(inspected.width === undefined ? {} : { width: inspected.width }),
      ...(inspected.height === undefined ? {} : { height: inspected.height }),
      audioPolicy: received.audioPolicy,
      defaultTranslations: new Map(),
      status: requiresProcessing ? "queued" : "ready",
      progress: requiresProcessing ? 0 : 100,
      processingStage: requiresProcessing ? "queued" : "ready",
      uploadedBy: toObjectId(actor.id),
    });
    if (requiresProcessing) media.processingJobId = media.id;
    await media.save();
    if (requiresProcessing) {
      try {
        await mediaQueue.enqueue(media.id, inspected.kind);
      } catch (error) {
        media.status = "failed";
        media.processingStage = "failed";
        media.processingError =
          error instanceof Error
            ? error.message.slice(0, 2_000)
            : "The optimization job could not be queued.";
        await media.save();
      }
    }
    return toAdminMediaDto(media, storageProvider);
  } catch (error) {
    if (storedKey !== undefined) {
      await storageProvider.delete(storedKey).catch(() => undefined);
    }
    throw error;
  } finally {
    await removeReceivedUpload(received);
  }
}

export async function retryMediaProcessing(
  id: string,
  mediaQueue: MediaJobQueue,
  storageProvider: StorageProvider,
): Promise<AdminMediaDto> {
  const media = await MediaModel.findById(id).select("+sourceStorage");
  if (media === null) {
    throw new AppError(404, "MEDIA_NOT_FOUND", "The media record was not found.");
  }
  if (media.status !== "failed" || (media.kind !== "image" && media.kind !== "video")) {
    throw new AppError(409, "MEDIA_RETRY_UNAVAILABLE", "Only failed image or video processing can be retried.");
  }
  if (
    media.sourceStorage === undefined ||
    media.sourceStorage.provider !== storageProvider.id ||
    !(await storageProvider.exists(media.sourceStorage.key))
  ) {
    throw new AppError(409, "MEDIA_SOURCE_EXPIRED", "The private source has expired; upload the file again.");
  }
  media.status = "queued";
  media.processingStage = "queued";
  media.progress = 0;
  media.processingJobId = media.id;
  media.set("processingError", undefined);
  await media.save();
  try {
    await mediaQueue.retry(media.id, media.kind);
  } catch (error) {
    media.status = "failed";
    media.processingStage = "failed";
    media.processingError = error instanceof Error ? error.message.slice(0, 2_000) : "The retry could not be queued.";
    await media.save();
  }
  return toAdminMediaDto(media, storageProvider);
}

async function productRequiresVideoPoster(
  mediaId: Types.ObjectId,
  session: ClientSession,
): Promise<boolean> {
  const localeCodes = await listLanguageCodes();
  const videoUsage = {
    mediaId,
    role: { $in: ["video", "backgroundVideo"] },
  };
  return (
    (await ProductModel.exists({
      status: { $ne: "deleting" },
      $or: [
        { mediaUsages: { $elemMatch: videoUsage } },
        {
          "publishedGlobal.data.mediaUsages": { $elemMatch: videoUsage },
        },
        ...localeCodes.map((locale) => ({
          [`publishedSnapshots.${locale}.data.mediaUsages`]: {
            $elemMatch: videoUsage,
          },
        })),
      ],
    }).session(session)) !== null
  );
}

export async function updateMedia(
  id: string,
  input: UpdateMediaRequest,
  storageProvider: StorageProvider,
): Promise<AdminMediaDto> {
  if (input.defaultTranslations !== undefined) {
    await assertLanguagesExist(Object.keys(input.defaultTranslations));
  }
  return inTransaction(async (session) => {
    const media = await requireMedia(id, session);
    assertVersion(media, input.version);
    if (media.status !== "ready") {
      throw new AppError(
        409,
        "MEDIA_NOT_READY",
        "Only ready media can be edited.",
      );
    }
    if (input.defaultTranslations !== undefined) {
      media.defaultTranslations = mediaTranslations(input.defaultTranslations);
    }
    if (
      input.posterMediaId === null &&
      media.kind === "video" &&
      (await productRequiresVideoPoster(media._id, session))
    ) {
      throw new AppError(
        409,
        "MEDIA_POSTER_REQUIRED_BY_PRODUCT",
        "This video is used by a product and must retain a ready image poster.",
      );
    }
    if (input.posterMediaId === null) {
      media.set("posterMediaId", undefined);
    } else if (input.posterMediaId !== undefined) {
      if (media.kind !== "video") {
        throw new AppError(
          422,
          "POSTER_VIDEO_REQUIRED",
          "Only videos can have poster images.",
        );
      }
      if (input.posterMediaId === media.id) {
        throw new AppError(
          422,
          "POSTER_SELF_REFERENCE",
          "A media record cannot use itself as a poster.",
        );
      }
      const posterLock = await MediaModel.updateOne(
        {
          _id: input.posterMediaId,
          status: "ready",
          kind: "image",
        },
        { $inc: { referenceGuard: 1 } },
        { session },
      );
      if (posterLock.matchedCount !== 1) {
        throw new AppError(
          409,
          "POSTER_NOT_READY",
          "Select a distinct ready image as the video poster.",
        );
      }
      media.posterMediaId = toObjectId(input.posterMediaId);
    }
    await media.save({ session });
    return toAdminMediaDto(media, storageProvider);
  });
}

function objectIdEquals(
  value: Types.ObjectId | undefined,
  expected: Types.ObjectId,
): boolean {
  return value?.equals(expected) ?? false;
}

function categoryUsages(
  category: CategoryDocument,
  mediaId: Types.ObjectId,
): MediaUsageDto[] {
  const usages: MediaUsageDto[] = [];
  const ownerId = category._id.toString();
  const ownerLabel = category.translations.get("en")?.name ?? category.slug;
  if (objectIdEquals(category.image?.mediaId, mediaId)) {
    usages.push({
      kind: "category-working-image",
      ownerType: "category",
      ownerId,
      ownerLabel,
      placement: "Category image",
      path: "image.mediaId",
    });
  }
  for (const [locale, translation] of category.translations.entries()) {
    if (objectIdEquals(translation?.seo.openGraphMediaId, mediaId)) {
      usages.push({
        kind: "category-working-seo",
        ownerType: "category",
        ownerId,
        ownerLabel,
        placement: "Open Graph image",
        path: `translations.${locale}.seo.openGraphMediaId`,
        locale,
      });
    }
    const snapshot = category.publishedSnapshots.get(locale);
    if (objectIdEquals(snapshot?.data.seo.openGraphMediaId, mediaId)) {
      usages.push({
        kind: "category-published-seo",
        ownerType: "category",
        ownerId,
        ownerLabel,
        placement: "Open Graph image",
        path: `publishedSnapshots.${locale}.data.seo.openGraphMediaId`,
        locale,
      });
    }
  }
  if (objectIdEquals(category.publishedGlobal?.data.imageMediaId, mediaId)) {
    usages.push({
      kind: "category-published-image",
      ownerType: "category",
      ownerId,
      ownerLabel,
      placement: "Category image",
      path: "publishedGlobal.data.imageMediaId",
    });
  }
  return usages;
}

function productMediaPlacement(role: ProductMediaRole): string {
  const labels: Record<ProductMediaRole, string> = {
    hero: "Hero photo",
    gallery: "Gallery photo",
    video: "Product video",
    backgroundVideo: "Background video",
    datasheet: "Datasheet",
    certificate: "Certificate",
    brochure: "Brochure",
    document: "Other document",
    openGraph: "Social sharing image",
  };
  return labels[role];
}

function productUsages(
  product: ProductDocument,
  mediaId: Types.ObjectId,
): MediaUsageDto[] {
  const usages: MediaUsageDto[] = [];
  const ownerId = product._id.toString();
  const ownerLabel = product.translations.get("en")?.name ?? product.slug;
  for (const [index, usage] of product.mediaUsages.entries()) {
    if (objectIdEquals(usage.mediaId, mediaId)) {
      usages.push({
        kind: "product-working-media",
        ownerType: "product",
        ownerId,
        ownerLabel,
        placement: productMediaPlacement(usage.role),
        path: `mediaUsages.${index}.mediaId`,
        ...(usage.locale === undefined
          ? {}
          : { locale: usage.locale }),
      });
    }
  }
  for (const [locale, translation] of product.translations.entries()) {
    for (const [index, feature] of (translation?.features ?? []).entries()) {
      if (objectIdEquals(feature.iconMediaId, mediaId)) {
        usages.push({
          kind: "product-working-feature-icon",
          ownerType: "product",
          ownerId,
          ownerLabel,
          placement: "Feature icon",
          path: `translations.${locale}.features.${index}.iconMediaId`,
          locale,
        });
      }
    }
    if (objectIdEquals(translation?.seo.openGraphMediaId, mediaId)) {
      usages.push({
        kind: "product-working-seo",
        ownerType: "product",
        ownerId,
        ownerLabel,
        placement: "Open Graph image",
        path: `translations.${locale}.seo.openGraphMediaId`,
        locale,
      });
    }

    const snapshot = product.publishedSnapshots.get(locale);
    for (const [index, usage] of (snapshot?.data.mediaUsages ?? []).entries()) {
      if (objectIdEquals(usage.mediaId, mediaId)) {
        usages.push({
          kind: "product-published-media",
          ownerType: "product",
          ownerId,
          ownerLabel,
          placement: productMediaPlacement(usage.role),
          path: `publishedSnapshots.${locale}.data.mediaUsages.${index}.mediaId`,
          locale,
        });
      }
    }
    for (const [index, feature] of (snapshot?.data.features ?? []).entries()) {
      if (objectIdEquals(feature.iconMediaId, mediaId)) {
        usages.push({
          kind: "product-published-feature-icon",
          ownerType: "product",
          ownerId,
          ownerLabel,
          placement: "Feature icon",
          path: `publishedSnapshots.${locale}.data.features.${index}.iconMediaId`,
          locale,
        });
      }
    }
    if (objectIdEquals(snapshot?.data.seo.openGraphMediaId, mediaId)) {
      usages.push({
        kind: "product-published-seo",
        ownerType: "product",
        ownerId,
        ownerLabel,
        placement: "Open Graph image",
        path: `publishedSnapshots.${locale}.data.seo.openGraphMediaId`,
        locale,
      });
    }
  }
  for (const [index, usage] of (
    product.publishedGlobal?.data.mediaUsages ?? []
  ).entries()) {
    if (objectIdEquals(usage.mediaId, mediaId)) {
      usages.push({
        kind: "product-published-media",
        ownerType: "product",
        ownerId,
        ownerLabel,
        placement: productMediaPlacement(usage.role),
        path: `publishedGlobal.data.mediaUsages.${index}.mediaId`,
        ...(usage.locale === undefined
          ? {}
          : { locale: usage.locale }),
      });
    }
  }
  return usages;
}

async function navigationUsages(
  mediaId: Types.ObjectId,
  session?: ClientSession,
): Promise<MediaUsageDto[]> {
  const query = NavigationConfigModel.findOne({ key: "primary" });
  if (session !== undefined) query.session(session);
  const config = await query;
  if (config === null) return [];
  const usages: MediaUsageDto[] = [];
  const visit = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      value.forEach((child, index) => visit(child, `${path}.${index}`));
      return;
    }
    if (typeof value !== "object" || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "mediaId" && child !== undefined && String(child) === mediaId.toString()) {
        usages.push({
          kind: "navigation-image",
          ownerType: "other",
          ownerId: config._id.toString(),
          ownerLabel: "Navbar and mega menu",
          placement: "Navigation image",
          path: `${path}.${key}`,
        });
      } else {
        visit(child, `${path}.${key}`);
      }
    }
  };
  visit(config.data, "data");
  return usages;
}

async function usageDocuments(
  mediaId: Types.ObjectId,
  session?: ClientSession,
): Promise<MediaUsageDto[]> {
  const localeCodes = await listLanguageCodes();
  const categoryPaths = [
    { "image.mediaId": mediaId },
    { "publishedGlobal.data.imageMediaId": mediaId },
    ...localeCodes.flatMap((locale) => [
      { [`translations.${locale}.seo.openGraphMediaId`]: mediaId },
      {
        [`publishedSnapshots.${locale}.data.seo.openGraphMediaId`]:
          mediaId,
      },
    ]),
  ];
  const categoryQuery = CategoryModel.find({
    status: { $ne: "deleting" },
    $or: categoryPaths,
  });
  const productPaths = [
    { "mediaUsages.mediaId": mediaId },
    { "publishedGlobal.data.mediaUsages.mediaId": mediaId },
    ...localeCodes.flatMap((locale) => [
      { [`translations.${locale}.features.iconMediaId`]: mediaId },
      { [`translations.${locale}.seo.openGraphMediaId`]: mediaId },
      {
        [`publishedSnapshots.${locale}.data.mediaUsages.mediaId`]: mediaId,
      },
      {
        [`publishedSnapshots.${locale}.data.features.iconMediaId`]: mediaId,
      },
      {
        [`publishedSnapshots.${locale}.data.seo.openGraphMediaId`]: mediaId,
      },
    ]),
  ];
  const productQuery = ProductModel.find({
    status: { $ne: "deleting" },
    $or: productPaths,
  });
  const posterQuery = MediaModel.find({
    status: { $ne: "deleting" },
    posterMediaId: mediaId,
  });
  if (session !== undefined) {
    categoryQuery.session(session);
    productQuery.session(session);
    posterQuery.session(session);
  }
  const [categories, products, posterOwners, navigation] = await Promise.all([
    categoryQuery,
    productQuery,
    posterQuery,
    navigationUsages(mediaId, session),
  ]);
  const usages = categories.flatMap((category) =>
    categoryUsages(category, mediaId),
  );
  usages.push(...products.flatMap((product) => productUsages(product, mediaId)));
  usages.push(
    ...posterOwners.map((media) => ({
      kind: "media-poster" as const,
      ownerType: "media" as const,
      ownerId: media._id.toString(),
      ownerLabel: media.originalName,
      placement: "Video poster",
      path: "posterMediaId",
    })),
  );
  usages.push(...navigation);
  return usages.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.ownerLabel.localeCompare(right.ownerLabel) ||
      left.path.localeCompare(right.path) ||
      left.ownerId.localeCompare(right.ownerId),
  );
}

export async function getMediaUsages(id: string): Promise<MediaUsagesDto> {
  await requireMedia(id);
  return { usages: await usageDocuments(toObjectId(id)) };
}

export async function lockReadyCategoryMedia(
  mediaIds: readonly string[],
  session: ClientSession,
): Promise<void> {
  for (const id of new Set(mediaIds)) {
    const result = await MediaModel.updateOne(
      { _id: id, status: "ready", kind: "image" },
      { $inc: { referenceGuard: 1 } },
      { session },
    );
    if (result.matchedCount !== 1) {
      throw new AppError(
        409,
        "MEDIA_NOT_READY",
        "Category images and SEO media must reference ready images.",
      );
    }
  }
}

export async function deleteMedia(
  id: string,
  version: number,
  storageProvider: StorageProvider,
): Promise<void> {
  const previousStatus = await inTransaction(async (session) => {
    const media = await requireMedia(id, session);
    if (media.status === "deleting") return "ready" as const;
    assertVersion(media, version);
    if (media.status !== "ready" && media.status !== "failed") {
      throw new AppError(
        409,
        "MEDIA_DELETE_UNAVAILABLE",
        "This media record cannot currently be deleted.",
      );
    }
    const status = media.status;
    media.status = "deleting";
    await media.save({ session });
    return status;
  });

  const mediaId = toObjectId(id);
  const usages = await usageDocuments(mediaId);
  if (usages.length > 0) {
    await inTransaction(async (session) => {
      const media = await requireMedia(id, session);
      if (media.status === "deleting") {
        media.status = previousStatus;
        await media.save({ session });
      }
      return true;
    });
    throw new AppError(
      409,
      "MEDIA_IN_USE",
      "This media is referenced. Remove every usage before deleting it.",
    );
  }

  const media = await MediaModel.findById(id).select("+sourceStorage");
  if (media === null) {
    throw new AppError(404, "MEDIA_NOT_FOUND", "The media record was not found.");
  }
  const storedObjects = [
    media.storage,
    media.sourceStorage,
    ...media.variants.map((variant) => variant.storage),
    media.generatedPoster?.storage,
  ].filter((value): value is NonNullable<typeof value> => value !== undefined);
  if (storedObjects.some((stored) => stored.provider !== storageProvider.id)) {
    throw new AppError(
      503,
      "STORAGE_PROVIDER_UNAVAILABLE",
      "The media storage provider is unavailable.",
    );
  }
  try {
    await Promise.all(
      [...new Set(storedObjects.map((stored) => stored.key))].map((key) =>
        storageProvider.delete(key),
      ),
    );
  } catch {
    throw new AppError(
      503,
      "MEDIA_CLEANUP_FAILED",
      "The stored object could not be removed. Retry deletion safely.",
    );
  }

  try {
    await inTransaction(async (session) => {
      const deleting = await requireMedia(id, session);
      if (deleting.status !== "deleting") {
        throw new AppError(
          409,
          "MEDIA_DELETE_STATE_CHANGED",
          "The media deletion state changed. Refresh and retry.",
        );
      }
      const concurrentUsages = await usageDocuments(mediaId, session);
      if (concurrentUsages.length > 0) {
        throw new AppError(
          409,
          "MEDIA_IN_USE",
          "This media became referenced during deletion.",
        );
      }
      await MediaModel.deleteOne({ _id: mediaId, status: "deleting" }).session(
        session,
      );
      return true;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      503,
      "MEDIA_CLEANUP_FAILED",
      "The media record could not be finalized. Retry deletion safely.",
    );
  }
}
