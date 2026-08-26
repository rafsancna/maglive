import type { FieldError, ProductMediaRole } from "@maglive/contracts";
import type { ClientSession, Types } from "mongoose";
import { AppError } from "../errors/AppError.js";
import { CategoryModel, type CategoryDocument } from "../models/Category.js";
import { MediaModel } from "../models/Media.js";
import type { ProductDocument } from "../models/Product.js";

type ExpectedMediaKind = "image" | "video" | "document";

type MediaRequirement = Readonly<{
  id: Types.ObjectId;
  expectedKind: ExpectedMediaKind;
  path: string;
}>;

function expectedKindForRole(role: ProductMediaRole): ExpectedMediaKind {
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

function workingMediaRequirements(
  product: ProductDocument,
): MediaRequirement[] {
  const requirements: MediaRequirement[] = product.mediaUsages.map(
    (usage, index) => ({
      id: usage.mediaId,
      expectedKind: expectedKindForRole(usage.role),
      path: `mediaUsages.${index}.mediaId`,
    }),
  );
  for (const [locale, translation] of product.translations) {
    for (const [index, feature] of translation.features.entries()) {
      if (feature.iconMediaId !== undefined) {
        requirements.push({
          id: feature.iconMediaId,
          expectedKind: "image",
          path: `translations.${locale}.features.${index}.iconMediaId`,
        });
      }
    }
    if (translation.seo.openGraphMediaId !== undefined) {
      requirements.push({
        id: translation.seo.openGraphMediaId,
        expectedKind: "image",
        path: `translations.${locale}.seo.openGraphMediaId`,
      });
    }
  }
  return requirements;
}

function referenceError(
  requirement: MediaRequirement,
  message: string,
): AppError {
  const details: FieldError[] = [
    {
      path: requirement.path,
      code: "PRODUCT_MEDIA_INVALID",
      message,
    },
  ];
  return new AppError(422, "PRODUCT_MEDIA_INVALID", message, details);
}

export async function lockProductWorkingMediaReferences(
  product: ProductDocument,
  session: ClientSession,
): Promise<void> {
  const seen = new Set<string>();
  for (const requirement of workingMediaRequirements(product)) {
    const key = `${requirement.id.toString()}:${requirement.expectedKind}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const filter: Record<string, unknown> = {
      _id: requirement.id,
      status: "ready",
      kind: requirement.expectedKind,
    };
    if (requirement.expectedKind === "document") {
      filter.mimeType = "application/pdf";
    }
    const locked = await MediaModel.updateOne(
      filter,
      { $inc: { referenceGuard: 1 } },
      { session },
    );
    if (locked.matchedCount !== 1) {
      throw referenceError(
        requirement,
        `Select ready ${requirement.expectedKind} media compatible with this product field.`,
      );
    }
    if (requirement.expectedKind !== "video") continue;
    const video = await MediaModel.findById(requirement.id).session(session);
    if (video?.posterMediaId === undefined) {
      throw referenceError(
        requirement,
        "Product videos require a ready image poster.",
      );
    }
    const posterLock = await MediaModel.updateOne(
      { _id: video.posterMediaId, status: "ready", kind: "image" },
      { $inc: { referenceGuard: 1 } },
      { session },
    );
    if (posterLock.matchedCount !== 1) {
      throw referenceError(
        requirement,
        "The product video poster must be a ready image.",
      );
    }
  }
}

async function lockCategory(
  id: Types.ObjectId,
  filter: Record<string, unknown>,
  session: ClientSession,
  errorCode: string,
  message: string,
): Promise<void> {
  const result = await CategoryModel.updateOne(
    { _id: id, ...filter },
    { $inc: { referenceGuard: 1 } },
    { session },
  );
  if (result.matchedCount !== 1) {
    throw new AppError(422, errorCode, message, [
      { path: "categoryId", code: errorCode, message },
    ]);
  }
}

export async function lockProductCategoryAssignment(
  categoryId: Types.ObjectId,
  previousCategoryId: Types.ObjectId | undefined,
  session: ClientSession,
): Promise<CategoryDocument> {
  if (
    previousCategoryId !== undefined &&
    !previousCategoryId.equals(categoryId)
  ) {
    await lockCategory(
      previousCategoryId,
      { status: { $ne: "deleting" } },
      session,
      "PRODUCT_CATEGORY_CHANGE_CONFLICT",
      "The current product category is being changed. Refresh and try again.",
    );
  }
  await lockCategory(
    categoryId,
    { status: "active" },
    session,
    "PRODUCT_CATEGORY_INVALID",
    "Select an active leaf category.",
  );
  const category = await CategoryModel.findById(categoryId).session(session);
  if (category === null) {
    throw new AppError(
      422,
      "PRODUCT_CATEGORY_INVALID",
      "Select an active leaf category.",
    );
  }
  const childExists = await CategoryModel.exists({
    parentId: categoryId,
    status: { $ne: "deleting" },
  }).session(session);
  if (childExists !== null) {
    throw new AppError(
      422,
      "PRODUCT_CATEGORY_NOT_LEAF",
      "Assign products to a leaf category.",
      [
        {
          path: "categoryId",
          code: "PRODUCT_CATEGORY_NOT_LEAF",
          message: "Assign products to a leaf category.",
        },
      ],
    );
  }
  return category;
}

export async function lockProductPublicationReferences(
  product: ProductDocument,
  session: ClientSession,
): Promise<void> {
  const category = await lockProductCategoryAssignment(
    product.categoryId,
    product.categoryId,
    session,
  );
  if (category.parentId !== null) {
    await lockCategory(
      category.parentId,
      { status: "active" },
      session,
      "PRODUCT_CATEGORY_ANCESTOR_INVALID",
      "Every product category ancestor must remain active.",
    );
  }
  await lockProductWorkingMediaReferences(product, session);
}
