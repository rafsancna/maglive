import {
  isLocaleCode,
  type CreateProductRequest,
  type DuplicateProductRequest,
  type LocaleCode,
  type ProductAdminDto,
  type ProductWorkingData,
  type UnpublishProductRequest,
  type UpdateProductRequest,
} from "@maglive/contracts";
import mongoose, {
  Types,
  type ClientSession,
  type mongo,
} from "mongoose";
import { validateProductUnpublication } from "../domain/productPublication.js";
import { AppError } from "../errors/AppError.js";
import {
  ProductModel,
  toProductAdminDto,
  type ProductDocument,
} from "../models/Product.js";
import {
  lockProductCategoryAssignment,
  lockProductWorkingMediaReferences,
} from "./productReferenceService.js";

type AdminActor = Readonly<{ id: string }>;

const WORKING_FIELDS = [
  "slug",
  "categoryId",
  "model",
  "series",
  "translations",
  "specifications",
  "mediaUsages",
  "pageTemplate",
  "displayOrder",
  "featured",
] as const satisfies readonly (keyof ProductWorkingData)[];

function toObjectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
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
    "This product changed after it was loaded. Refresh and try again.",
  );
}

function assertVersion(product: ProductDocument, version: number): void {
  if (product.version !== version) throwVersionConflict();
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
      "The product transaction did not complete.",
    );
  }
  return result;
}

async function requireProduct(
  id: string,
  session?: ClientSession,
): Promise<ProductDocument> {
  const query = ProductModel.findOne({
    _id: id,
    status: { $ne: "deleting" },
  });
  if (session !== undefined) query.session(session);
  const product = await query;
  if (product === null) {
    throw new AppError(404, "PRODUCT_NOT_FOUND", "The product was not found.");
  }
  return product;
}

function assertEditable(product: ProductDocument): void {
  if (product.status === "archived") {
    throw new AppError(
      409,
      "PRODUCT_ARCHIVED",
      "Archived products cannot be edited or published.",
    );
  }
}

function setWorkingFields(
  product: ProductDocument,
  values: {
    [Field in keyof ProductWorkingData]?:
      | ProductWorkingData[Field]
      | null
      | undefined;
  },
): void {
  for (const field of WORKING_FIELDS) {
    const value = values[field];
    if ((field === "model" || field === "series") && value === null) {
      product.set(field, undefined);
    } else if (value !== undefined && value !== null) {
      product.set(field, value);
    }
  }
}

function workingData(product: ProductDocument): ProductWorkingData {
  const dto = toProductAdminDto(product);
  return {
    slug: dto.slug,
    categoryId: dto.categoryId,
    ...(dto.model === undefined ? {} : { model: dto.model }),
    ...(dto.series === undefined ? {} : { series: dto.series }),
    translations: dto.translations,
    specifications: dto.specifications,
    mediaUsages: dto.mediaUsages,
    pageTemplate: dto.pageTemplate,
    displayOrder: dto.displayOrder,
    featured: dto.featured,
  };
}

export async function getAdminProduct(id: string): Promise<ProductAdminDto> {
  return toProductAdminDto(await requireProduct(id));
}

export async function createProduct(
  input: CreateProductRequest,
  actor: AdminActor,
): Promise<ProductAdminDto> {
  try {
    return await inTransaction(async (session) => {
      const product = new ProductModel({
        ...input,
        publishedSnapshots: new Map(),
        status: "draft",
        createdBy: toObjectId(actor.id),
        updatedBy: toObjectId(actor.id),
      });
      await lockProductCategoryAssignment(product.categoryId, undefined, session);
      await lockProductWorkingMediaReferences(product, session);
      await product.save({ session });
      return toProductAdminDto(product);
    });
  } catch (error) {
    if (duplicateKeyError(error)) {
      throw new AppError(
        409,
        "PRODUCT_SLUG_EXISTS",
        "That product slug is already in use.",
      );
    }
    throw error;
  }
}

export async function updateProduct(
  id: string,
  input: UpdateProductRequest,
  actor: AdminActor,
): Promise<ProductAdminDto> {
  try {
    return await inTransaction(async (session) => {
      const product = await requireProduct(id, session);
      assertEditable(product);
      assertVersion(product, input.version);
      if (
        input.slug !== undefined &&
        product.firstPublishedAt !== undefined &&
        input.slug !== product.slug
      ) {
        throw new AppError(
          409,
          "PUBLISHED_SLUG_IMMUTABLE",
          "A product slug cannot change after its first publication.",
        );
      }
      const previousCategoryId = product.categoryId;
      setWorkingFields(product, input);
      await lockProductCategoryAssignment(
        product.categoryId,
        previousCategoryId,
        session,
      );
      await lockProductWorkingMediaReferences(product, session);
      product.updatedBy = toObjectId(actor.id);
      await product.save({ session });
      return toProductAdminDto(product);
    });
  } catch (error) {
    if (duplicateKeyError(error)) {
      throw new AppError(
        409,
        "PRODUCT_SLUG_EXISTS",
        "That product slug is already in use.",
      );
    }
    if (error instanceof mongoose.Error.VersionError) throwVersionConflict();
    throw error;
  }
}

function duplicateSlugCandidate(sourceSlug: string, sequence: number): string {
  const suffix = sequence === 1 ? "-copy" : `-copy-${sequence}`;
  const base = sourceSlug.slice(0, 140 - suffix.length).replace(/-+$/g, "");
  return `${base}${suffix}`;
}

async function chooseDuplicateSlug(
  sourceSlug: string,
  requestedSlug: string | undefined,
  session: ClientSession,
): Promise<string> {
  if (requestedSlug !== undefined) {
    const exists = await ProductModel.exists({ slug: requestedSlug }).session(
      session,
    );
    if (exists !== null) {
      throw new AppError(
        409,
        "PRODUCT_SLUG_EXISTS",
        "That product slug is already in use.",
      );
    }
    return requestedSlug;
  }
  for (let sequence = 1; sequence <= 1_000; sequence += 1) {
    const candidate = duplicateSlugCandidate(sourceSlug, sequence);
    const exists = await ProductModel.exists({ slug: candidate }).session(
      session,
    );
    if (exists === null) return candidate;
  }
  throw new AppError(
    409,
    "PRODUCT_DUPLICATE_SLUG_UNAVAILABLE",
    "Choose a unique slug for the duplicate product.",
  );
}

export async function duplicateProduct(
  id: string,
  input: DuplicateProductRequest,
  actor: AdminActor,
): Promise<ProductAdminDto> {
  try {
    return await inTransaction(async (session) => {
      const source = await requireProduct(id, session);
      assertVersion(source, input.version);
      const slug = await chooseDuplicateSlug(source.slug, input.slug, session);
      const duplicate = new ProductModel({
        ...workingData(source),
        slug,
        publishedSnapshots: new Map(),
        status: "draft",
        createdBy: toObjectId(actor.id),
        updatedBy: toObjectId(actor.id),
      });
      await lockProductCategoryAssignment(
        duplicate.categoryId,
        undefined,
        session,
      );
      await lockProductWorkingMediaReferences(duplicate, session);
      await duplicate.save({ session });
      return toProductAdminDto(duplicate);
    });
  } catch (error) {
    if (duplicateKeyError(error)) {
      throw new AppError(
        409,
        "PRODUCT_SLUG_EXISTS",
        "That product slug is already in use.",
      );
    }
    throw error;
  }
}

export async function unpublishProduct(
  id: string,
  input: UnpublishProductRequest,
  actor: AdminActor,
): Promise<ProductAdminDto> {
  return inTransaction(async (session) => {
    const product = await requireProduct(id, session);
    assertVersion(product, input.version);
    const retentionErrors = validateProductUnpublication(product, input.locale);
    if (retentionErrors.length > 0) {
      throw new AppError(
        409,
        "DEFAULT_LOCALE_REQUIRED",
        retentionErrors[0]?.message ?? "The default locale must remain published.",
        retentionErrors.map(({ path, code, message }) => ({
          path,
          code,
          message,
        })),
      );
    }
    const locales: LocaleCode[] =
      input.locale === undefined
        ? [...product.publishedSnapshots.keys()].filter(
            (locale): locale is LocaleCode => isLocaleCode(locale),
          )
        : [input.locale];
    if (
      locales.length === 0 ||
      (input.locale !== undefined && !product.publishedSnapshots.has(input.locale))
    ) {
      throw new AppError(
        409,
        "PRODUCT_LOCALE_NOT_PUBLISHED",
        "The requested product locale is not published.",
      );
    }
    for (const locale of locales) product.publishedSnapshots.delete(locale);
    if (product.publishedSnapshots.size === 0) {
      product.set("publishedGlobal", undefined);
      product.status = "draft";
    } else if (product.status !== "archived") {
      product.status = "published";
    }
    product.updatedBy = toObjectId(actor.id);
    await product.save({ session });
    return toProductAdminDto(product);
  });
}

export async function archiveProduct(
  id: string,
  version: number,
  actor: AdminActor,
): Promise<ProductAdminDto> {
  return inTransaction(async (session) => {
    const product = await requireProduct(id, session);
    assertVersion(product, version);
    product.status = "archived";
    product.updatedBy = toObjectId(actor.id);
    await product.save({ session });
    return toProductAdminDto(product);
  });
}

export async function deleteProduct(
  id: string,
  version: number,
): Promise<void> {
  await inTransaction(async (session) => {
    const product = await requireProduct(id, session);
    assertVersion(product, version);
    if (
      product.status !== "draft" ||
      product.firstPublishedAt !== undefined ||
      product.publishedGlobal !== undefined ||
      product.publishedSnapshots.size > 0
    ) {
      throw new AppError(
        409,
        "PRODUCT_DELETE_DENIED",
        "Only never-published draft products can be permanently deleted.",
      );
    }
    product.status = "deleting";
    await product.save({ session });
    await ProductModel.deleteOne({ _id: product._id, status: "deleting" }).session(
      session,
    );
    return true;
  });
}

export async function categoryHasProductReferences(
  categoryId: Types.ObjectId,
  session: ClientSession,
): Promise<boolean> {
  return (
    (await ProductModel.exists({
      status: { $ne: "deleting" },
      $or: [
        { categoryId },
        { "publishedGlobal.data.categoryId": categoryId },
      ],
    }).session(session)) !== null
  );
}

export async function categoryHasPublishedProductLocale(
  categoryId: Types.ObjectId,
  locale: LocaleCode,
  session: ClientSession,
): Promise<boolean> {
  return (
    (await ProductModel.exists({
      status: { $ne: "deleting" },
      "publishedGlobal.data.categoryId": categoryId,
      [`publishedSnapshots.${locale}`]: { $exists: true },
    }).session(session)) !== null
  );
}
