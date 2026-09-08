import {
  type PublicMediaDto,
  type PublicSiteSettingsDto,
  type SafeAdminDto,
  type SiteSettingsAdminDto,
  type UpdateSiteSettingsRequest,
} from "@maglive/contracts";
import mongoose, { Types, type ClientSession } from "mongoose";
import { AppError } from "../errors/AppError.js";
import { MediaModel, type MediaDocument } from "../models/Media.js";
import {
  SiteSettingsModel,
  type SiteSettingsDocument,
} from "../models/SiteSettings.js";
import type { StorageProvider } from "../storage/StorageProvider.js";

function adminDto(settings: SiteSettingsDocument | null): SiteSettingsAdminDto {
  if (settings === null) return { version: 0 };
  return {
    ...(settings.iconMediaId === undefined
      ? {}
      : { iconMediaId: settings.iconMediaId.toString() }),
    version: settings.version,
    updatedAt: settings.updatedAt.toISOString(),
  };
}

function publicMedia(
  media: MediaDocument,
  storageProvider: StorageProvider,
): PublicMediaDto | undefined {
  if (
    media.kind !== "image" ||
    media.status !== "ready" ||
    media.storage === undefined ||
    media.storage.provider !== storageProvider.id
  ) {
    return undefined;
  }
  return {
    id: media._id.toString(),
    kind: media.kind,
    url: storageProvider.getPublicUrl(media.storage.key),
    mimeType: media.mimeType,
    ...(media.width === undefined ? {} : { width: media.width }),
    ...(media.height === undefined ? {} : { height: media.height }),
  };
}

export async function getAdminSiteSettings(): Promise<SiteSettingsAdminDto> {
  return adminDto(await SiteSettingsModel.findOne({ key: "site" }));
}

export async function getPublicSiteSettings(
  storageProvider: StorageProvider,
): Promise<PublicSiteSettingsDto> {
  const settings = await SiteSettingsModel.findOne({ key: "site" });
  if (settings === null || settings.iconMediaId === undefined) {
    return { version: settings?.version ?? 0 };
  }
  const media = await MediaModel.findById(settings.iconMediaId);
  const icon = media === null ? undefined : publicMedia(media, storageProvider);
  return {
    ...(icon === undefined ? {} : { icon }),
    version: settings.version,
  };
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
    throw new AppError(
      500,
      "TRANSACTION_FAILED",
      "The site settings transaction did not complete.",
    );
  }
  return result;
}

async function assertReadyIcon(
  mediaId: string | null,
  session: ClientSession,
): Promise<void> {
  if (mediaId === null) return;
  const media = await MediaModel.findOne({
    _id: mediaId,
    kind: "image",
    status: "ready",
    storage: { $exists: true },
  }).session(session);
  if (media === null) {
    throw new AppError(
      422,
      "SITE_ICON_NOT_READY",
      "The browser icon must reference a ready image from the media library.",
    );
  }
}

export async function updateAdminSiteSettings(
  input: UpdateSiteSettingsRequest,
  admin: SafeAdminDto,
): Promise<SiteSettingsAdminDto> {
  return inTransaction(async (session) => {
    await assertReadyIcon(input.iconMediaId, session);
    const current = await SiteSettingsModel.findOne({ key: "site" }).session(
      session,
    );
    const updatedBy = new Types.ObjectId(admin.id);

    if (current === null) {
      if (input.version !== 0) {
        throw new AppError(
          409,
          "VERSION_CONFLICT",
          "The site settings changed elsewhere. Refresh and retry.",
        );
      }
      const created = new SiteSettingsModel({
        key: "site",
        ...(input.iconMediaId === null
          ? {}
          : { iconMediaId: new Types.ObjectId(input.iconMediaId) }),
        version: 1,
        updatedBy,
      });
      await created.save({ session });
      return adminDto(created);
    }

    if (current.version !== input.version) {
      throw new AppError(
        409,
        "VERSION_CONFLICT",
        "The site settings changed elsewhere. Refresh and retry.",
      );
    }

    const updated = await SiteSettingsModel.findOneAndUpdate(
      { key: "site", version: input.version },
      input.iconMediaId === null
        ? {
            $unset: { iconMediaId: 1 },
            $set: { updatedBy },
            $inc: { version: 1 },
          }
        : {
            $set: {
              iconMediaId: new Types.ObjectId(input.iconMediaId),
              updatedBy,
            },
            $inc: { version: 1 },
          },
      { new: true, runValidators: true, session },
    );
    if (updated === null) {
      throw new AppError(
        409,
        "VERSION_CONFLICT",
        "The site settings changed elsewhere. Refresh and retry.",
      );
    }
    return adminDto(updated);
  });
}
