import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";

export type CategorySeo = {
  focusKeyphrase?: string;
  title?: string;
  description?: string;
  openGraphMediaId?: Types.ObjectId;
  openGraphTitle?: string;
  openGraphDescription?: string;
  canonicalUrlOverride?: string;
  robots?: { index: boolean; follow: boolean };
};

export type CategoryTranslation = {
  name: string;
  description?: string;
  seo: CategorySeo;
};

export type CategoryImageTranslation = {
  alt?: string;
  title?: string;
};

export type CategoryImageUsage = {
  mediaId: Types.ObjectId;
  translations: Map<string, CategoryImageTranslation>;
};

export type PublishedCategoryGlobalData = {
  slug: string;
  parentId: Types.ObjectId | null;
  sortOrder: number;
  imageMediaId?: Types.ObjectId;
};

export type PublishedCategoryLocaleData = {
  name: string;
  description?: string;
  seo: {
    focusKeyphrase?: string;
    title: string;
    description?: string;
    openGraphMediaId?: Types.ObjectId;
    openGraphTitle?: string;
    openGraphDescription?: string;
    canonicalUrlOverride?: string;
    robots?: { index: boolean; follow: boolean };
  };
  image?: {
    alt: string;
    title?: string;
  };
};

export type PublishedCategoryGlobal = {
  sourceVersion: number;
  sourceHash: string;
  globalRevision: string;
  publishedAt: Date;
  data: PublishedCategoryGlobalData;
};

export type PublishedCategoryLocale = {
  sourceVersion: number;
  sourceHash: string;
  globalRevision: string;
  publicationRevision: string;
  publishedAt: Date;
  data: PublishedCategoryLocaleData;
};

export type Category = {
  slug: string;
  parentId: Types.ObjectId | null;
  sortOrder: number;
  translations: Map<string, CategoryTranslation>;
  image?: CategoryImageUsage;
  publishedGlobal?: PublishedCategoryGlobal;
  publishedSnapshots: Map<string, PublishedCategoryLocale>;
  status: "active" | "archived" | "deleting";
  referenceGuard: number;
  firstPublishedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type CategoryDocument = HydratedDocument<Category>;

const seoSchema = new Schema<CategorySeo>(
  {
    focusKeyphrase: { type: String, trim: true, maxlength: 160 },
    title: { type: String, trim: true, maxlength: 70 },
    description: { type: String, trim: true, maxlength: 320 },
    openGraphMediaId: { type: Schema.Types.ObjectId },
    openGraphTitle: { type: String, trim: true, maxlength: 70 },
    openGraphDescription: { type: String, trim: true, maxlength: 320 },
    canonicalUrlOverride: { type: String, trim: true, maxlength: 2_048 },
    robots: {
      type: new Schema(
        {
          index: { type: Boolean, required: true },
          follow: { type: Boolean, required: true },
        },
        { _id: false },
      ),
    },
  },
  { _id: false },
);

const translationSchema = new Schema<CategoryTranslation>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2_000 },
    seo: { type: seoSchema, required: true, default: () => ({}) },
  },
  { _id: false },
);

const imageTranslationSchema = new Schema<CategoryImageTranslation>(
  {
    alt: { type: String, trim: true, maxlength: 240 },
    title: { type: String, trim: true, maxlength: 240 },
  },
  { _id: false },
);

const imageUsageSchema = new Schema<CategoryImageUsage>(
  {
    mediaId: { type: Schema.Types.ObjectId, required: true },
    translations: {
      type: Map,
      of: imageTranslationSchema,
      required: true,
      default: () => new Map(),
    },
  },
  { _id: false },
);

const publishedGlobalDataSchema = new Schema<PublishedCategoryGlobalData>(
  {
    slug: { type: String, required: true },
    parentId: { type: Schema.Types.ObjectId, default: null },
    sortOrder: { type: Number, required: true, min: 0 },
    imageMediaId: { type: Schema.Types.ObjectId },
  },
  { _id: false },
);

const publishedLocaleDataSchema = new Schema<PublishedCategoryLocaleData>(
  {
    name: { type: String, required: true },
    description: String,
    seo: {
      type: new Schema(
        {
          title: { type: String, required: true },
          description: String,
          openGraphMediaId: Schema.Types.ObjectId,
          openGraphTitle: { type: String, maxlength: 70 },
          openGraphDescription: { type: String, maxlength: 320 },
          focusKeyphrase: { type: String, maxlength: 160 },
          canonicalUrlOverride: { type: String, maxlength: 2_048 },
          robots: {
            type: new Schema(
              {
                index: { type: Boolean, required: true },
                follow: { type: Boolean, required: true },
              },
              { _id: false },
            ),
          },
        },
        { _id: false },
      ),
      required: true,
    },
    image: {
      type: new Schema(
        {
          alt: { type: String, required: true },
          title: String,
        },
        { _id: false },
      ),
    },
  },
  { _id: false },
);

const publishedGlobalSchema = new Schema<PublishedCategoryGlobal>(
  {
    sourceVersion: { type: Number, required: true, min: 0 },
    sourceHash: { type: String, required: true },
    globalRevision: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    data: { type: publishedGlobalDataSchema, required: true },
  },
  { _id: false },
);

const publishedLocaleSchema = new Schema<PublishedCategoryLocale>(
  {
    sourceVersion: { type: Number, required: true, min: 0 },
    sourceHash: { type: String, required: true },
    globalRevision: { type: String, required: true },
    publicationRevision: { type: String, required: true },
    publishedAt: { type: Date, required: true },
    data: { type: publishedLocaleDataSchema, required: true },
  },
  { _id: false },
);

const categorySchema = new Schema<Category>(
  {
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 120,
    },
    parentId: { type: Schema.Types.ObjectId, default: null },
    sortOrder: { type: Number, required: true, min: 0, default: 0 },
    translations: {
      type: Map,
      of: translationSchema,
      required: true,
      default: () => new Map(),
    },
    image: { type: imageUsageSchema },
    publishedGlobal: { type: publishedGlobalSchema },
    publishedSnapshots: {
      type: Map,
      of: publishedLocaleSchema,
      required: true,
      default: () => new Map(),
    },
    status: {
      type: String,
      enum: ["active", "archived", "deleting"],
      required: true,
      default: "active",
    },
    referenceGuard: { type: Number, required: true, default: 0, select: false },
    firstPublishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true },
    updatedBy: { type: Schema.Types.ObjectId, required: true },
  },
  {
    collection: "categories",
    timestamps: true,
    versionKey: "version",
    optimisticConcurrency: true,
  },
);

categorySchema.index({ slug: 1 }, { unique: true });
categorySchema.index({ parentId: 1, sortOrder: 1, _id: 1 });
categorySchema.index({ status: 1, "publishedGlobal.data.slug": 1 });

export const CategoryModel: Model<Category> =
  (mongoose.models.Category as Model<Category> | undefined) ??
  mongoose.model<Category>("Category", categorySchema);
