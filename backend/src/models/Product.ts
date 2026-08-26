import {
  PRODUCT_LIMITS,
  PRODUCT_MEDIA_ROLES,
  productAdminDtoSchema,
  productNestedKeySchema,
  productSlugSchema,
  type ProductAdminDto,
  type ProductMediaRole,
  type ProductStatus,
  type ProductTemplateId,
} from "@maglive/contracts";
import mongoose, {
  Schema,
  type HydratedDocument,
  type Model,
  type Types,
} from "mongoose";
import {
  productArrayValidators,
  strictSubdocumentOptions,
  supportedLocaleValueValidator,
  supportedLocaleValidator,
} from "./productSchemaHelpers.js";
import { publicationStateForDto } from "../domain/productPublication.js";

type LocalizedMap<T> = Map<string, T>;

export type ProductFeature = {
  key: string;
  title: string;
  body?: string;
  iconMediaId?: Types.ObjectId;
};

export type ProductTextItem = {
  key: string;
  title: string;
  body?: string;
};

export type ProductSeo = {
  title?: string;
  description?: string;
  keywords?: string[];
  openGraphTitle?: string;
  openGraphDescription?: string;
  openGraphMediaId?: Types.ObjectId;
};

export type ProductTranslation = {
  name: string;
  shortDescription?: string;
  longDescriptionMarkdown?: string;
  features: ProductFeature[];
  advantages: ProductTextItem[];
  applications: ProductTextItem[];
  warrantyInformation?: string;
  seo: ProductSeo;
};

export type SpecificationGroupTranslation = {
  label: string;
};

export type SpecificationItemTranslation = {
  label: string;
  valueOverride?: string;
  note?: string;
};

export type SpecificationItem = {
  key: string;
  order: number;
  value: string;
  unit?: string;
  translations: LocalizedMap<SpecificationItemTranslation>;
};

export type SpecificationGroup = {
  key: string;
  order: number;
  translations: LocalizedMap<SpecificationGroupTranslation>;
  items: SpecificationItem[];
};

export type ProductMediaTranslation = {
  alt?: string;
  title?: string;
  caption?: string;
};

export type ProductMediaUsage = {
  mediaId: Types.ObjectId;
  role: ProductMediaRole;
  order: number;
  locale?: string;
  translations: LocalizedMap<ProductMediaTranslation>;
};

export type PublishedProductGlobalSpecificationItem = {
  key: string;
  order: number;
  value: string;
  unit?: string;
};

export type PublishedProductGlobalSpecification = {
  key: string;
  order: number;
  items: PublishedProductGlobalSpecificationItem[];
};

export type PublishedProductGlobalMediaUsage = {
  mediaId: Types.ObjectId;
  role: ProductMediaRole;
  order: number;
  locale?: string;
};

export type PublishedProductGlobalData = {
  slug: string;
  categoryId: Types.ObjectId;
  model?: string;
  series?: string;
  specifications: PublishedProductGlobalSpecification[];
  mediaUsages: PublishedProductGlobalMediaUsage[];
  pageTemplate: ProductTemplateId;
  displayOrder: number;
  featured: boolean;
};

export type PublishedProductLocaleSpecificationItem = {
  key: string;
  label: string;
  valueOverride?: string;
  note?: string;
};

export type PublishedProductLocaleSpecification = {
  key: string;
  label: string;
  items: PublishedProductLocaleSpecificationItem[];
};

export type PublishedProductLocaleMediaUsage = {
  mediaId: Types.ObjectId;
  role: ProductMediaRole;
  order: number;
  locale?: string;
  alt?: string;
  title?: string;
  caption?: string;
};

export type PublishedProductLocaleData = {
  name: string;
  shortDescription: string;
  longDescriptionMarkdown?: string;
  features: ProductFeature[];
  advantages: ProductTextItem[];
  applications: ProductTextItem[];
  warrantyInformation?: string;
  seo: {
    title: string;
    description?: string;
    keywords: string[];
    openGraphTitle?: string;
    openGraphDescription?: string;
    openGraphMediaId?: Types.ObjectId;
  };
  specifications: PublishedProductLocaleSpecification[];
  mediaUsages: PublishedProductLocaleMediaUsage[];
};

export type PublishedProductGlobal = {
  sourceVersion: number;
  sourceHash: string;
  globalRevision: string;
  publishedAt: Date;
  data: PublishedProductGlobalData;
};

export type PublishedProductLocale = {
  sourceVersion: number;
  sourceHash: string;
  globalRevision: string;
  publicationRevision: string;
  publishedAt: Date;
  data: PublishedProductLocaleData;
};

export type Product = {
  slug: string;
  categoryId: Types.ObjectId;
  model?: string;
  series?: string;
  translations: LocalizedMap<ProductTranslation>;
  specifications: SpecificationGroup[];
  mediaUsages: ProductMediaUsage[];
  pageTemplate: ProductTemplateId;
  displayOrder: number;
  featured: boolean;
  publishedGlobal?: PublishedProductGlobal;
  publishedSnapshots: LocalizedMap<PublishedProductLocale>;
  status: ProductStatus;
  firstPublishedAt?: Date;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  version: number;
};

export type ProductDocument = HydratedDocument<Product>;

const nestedKey = {
  type: String,
  required: true,
  minlength: 1,
  maxlength: 64,
  validate: {
    validator: (value: string) => productNestedKeySchema.safeParse(value).success,
    message: "Nested keys must be lowercase kebab-case.",
  },
} as const;

const boundedOrder = {
  type: Number,
  required: true,
  min: 0,
  max: PRODUCT_LIMITS.orderMaximum,
} as const;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const productFeatureSchema = new Schema<ProductFeature>(
  {
    key: nestedKey,
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: PRODUCT_LIMITS.contentTitle,
    },
    body: { type: String, trim: true, maxlength: PRODUCT_LIMITS.contentBody },
    iconMediaId: Schema.Types.ObjectId,
  },
  strictSubdocumentOptions,
);

const productTextItemSchema = new Schema<ProductTextItem>(
  {
    key: nestedKey,
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: PRODUCT_LIMITS.contentTitle,
    },
    body: { type: String, trim: true, maxlength: PRODUCT_LIMITS.contentBody },
  },
  strictSubdocumentOptions,
);

const productSeoSchema = new Schema<ProductSeo>(
  {
    title: { type: String, trim: true, maxlength: PRODUCT_LIMITS.seoTitle },
    description: {
      type: String,
      trim: true,
      maxlength: PRODUCT_LIMITS.seoDescription,
    },
    keywords: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: PRODUCT_LIMITS.seoKeyword,
        },
      ],
      default: undefined,
      validate: productArrayValidators.seoKeywords,
    },
    openGraphTitle: {
      type: String,
      trim: true,
      maxlength: PRODUCT_LIMITS.seoTitle,
    },
    openGraphDescription: {
      type: String,
      trim: true,
      maxlength: PRODUCT_LIMITS.seoDescription,
    },
    openGraphMediaId: Schema.Types.ObjectId,
  },
  strictSubdocumentOptions,
);

const productTranslationSchema = new Schema<ProductTranslation>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: PRODUCT_LIMITS.name,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: PRODUCT_LIMITS.shortDescription,
    },
    longDescriptionMarkdown: {
      type: String,
      maxlength: PRODUCT_LIMITS.longDescriptionMarkdown,
    },
    features: {
      type: [productFeatureSchema],
      required: true,
      default: () => [],
      validate: productArrayValidators.content,
    },
    advantages: {
      type: [productTextItemSchema],
      required: true,
      default: () => [],
      validate: productArrayValidators.content,
    },
    applications: {
      type: [productTextItemSchema],
      required: true,
      default: () => [],
      validate: productArrayValidators.content,
    },
    warrantyInformation: {
      type: String,
      trim: true,
      maxlength: PRODUCT_LIMITS.warrantyInformation,
    },
    seo: { type: productSeoSchema, required: true, default: () => ({}) },
  },
  strictSubdocumentOptions,
);

const specificationGroupTranslationSchema =
  new Schema<SpecificationGroupTranslation>(
    {
      label: {
        type: String,
        required: true,
        trim: true,
        maxlength: PRODUCT_LIMITS.specificationLabel,
      },
    },
    strictSubdocumentOptions,
  );

const specificationItemTranslationSchema =
  new Schema<SpecificationItemTranslation>(
    {
      label: {
        type: String,
        required: true,
        trim: true,
        maxlength: PRODUCT_LIMITS.specificationLabel,
      },
      valueOverride: {
        type: String,
        trim: true,
        maxlength: PRODUCT_LIMITS.specificationValue,
      },
      note: {
        type: String,
        trim: true,
        maxlength: PRODUCT_LIMITS.specificationNote,
      },
    },
    strictSubdocumentOptions,
  );

const specificationItemSchema = new Schema<SpecificationItem>(
  {
    key: nestedKey,
    order: boundedOrder,
    value: {
      type: String,
      required: true,
      trim: true,
      maxlength: PRODUCT_LIMITS.specificationValue,
    },
    unit: {
      type: String,
      trim: true,
      maxlength: PRODUCT_LIMITS.specificationUnit,
    },
    translations: {
      type: Map,
      of: specificationItemTranslationSchema,
      required: true,
      default: () => new Map(),
      validate: supportedLocaleValidator,
    },
  },
  strictSubdocumentOptions,
);

const specificationGroupSchema = new Schema<SpecificationGroup>(
  {
    key: nestedKey,
    order: boundedOrder,
    translations: {
      type: Map,
      of: specificationGroupTranslationSchema,
      required: true,
      default: () => new Map(),
      validate: supportedLocaleValidator,
    },
    items: {
      type: [specificationItemSchema],
      required: true,
      default: () => [],
      validate: productArrayValidators.specificationItems,
    },
  },
  strictSubdocumentOptions,
);

const productMediaTranslationSchema = new Schema<ProductMediaTranslation>(
  {
    alt: { type: String, trim: true, maxlength: PRODUCT_LIMITS.mediaText },
    title: { type: String, trim: true, maxlength: PRODUCT_LIMITS.mediaText },
    caption: {
      type: String,
      trim: true,
      maxlength: PRODUCT_LIMITS.mediaCaption,
    },
  },
  strictSubdocumentOptions,
);

const productMediaUsageSchema = new Schema<ProductMediaUsage>(
  {
    mediaId: { type: Schema.Types.ObjectId, required: true },
    role: {
      type: String,
      enum: PRODUCT_MEDIA_ROLES,
      required: true,
    },
    order: boundedOrder,
    locale: { type: String, validate: supportedLocaleValueValidator },
    translations: {
      type: Map,
      of: productMediaTranslationSchema,
      required: true,
      default: () => new Map(),
      validate: supportedLocaleValidator,
    },
  },
  strictSubdocumentOptions,
);

const publishedGlobalSpecificationItemSchema =
  new Schema<PublishedProductGlobalSpecificationItem>(
    {
      key: nestedKey,
      order: boundedOrder,
      value: {
        type: String,
        required: true,
        maxlength: PRODUCT_LIMITS.specificationValue,
      },
      unit: { type: String, maxlength: PRODUCT_LIMITS.specificationUnit },
    },
    strictSubdocumentOptions,
  );

const publishedGlobalSpecificationSchema =
  new Schema<PublishedProductGlobalSpecification>(
    {
      key: nestedKey,
      order: boundedOrder,
      items: {
        type: [publishedGlobalSpecificationItemSchema],
        required: true,
        validate: productArrayValidators.specificationItems,
      },
    },
    strictSubdocumentOptions,
  );

const publishedGlobalMediaUsageSchema =
  new Schema<PublishedProductGlobalMediaUsage>(
    {
      mediaId: { type: Schema.Types.ObjectId, required: true },
      role: { type: String, required: true, enum: PRODUCT_MEDIA_ROLES },
      order: boundedOrder,
      locale: { type: String, validate: supportedLocaleValueValidator },
    },
    strictSubdocumentOptions,
  );

const publishedGlobalDataSchema = new Schema<PublishedProductGlobalData>(
  {
    slug: {
      type: String,
      required: true,
      maxlength: 140,
      validate: {
        validator: (value: string) => productSlugSchema.safeParse(value).success,
        message: "The published product slug is invalid or reserved.",
      },
    },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    model: { type: String, maxlength: PRODUCT_LIMITS.model },
    series: { type: String, maxlength: PRODUCT_LIMITS.series },
    specifications: {
      type: [publishedGlobalSpecificationSchema],
      required: true,
      validate: productArrayValidators.specificationGroups,
    },
    mediaUsages: {
      type: [publishedGlobalMediaUsageSchema],
      required: true,
      validate: productArrayValidators.mediaUsages,
    },
    pageTemplate: {
      type: String,
      enum: ["standard", "topcon-premium"],
      required: true,
    },
    displayOrder: boundedOrder,
    featured: { type: Boolean, required: true },
  },
  strictSubdocumentOptions,
);

const publishedLocaleSpecificationItemSchema =
  new Schema<PublishedProductLocaleSpecificationItem>(
    {
      key: nestedKey,
      label: {
        type: String,
        required: true,
        maxlength: PRODUCT_LIMITS.specificationLabel,
      },
      valueOverride: {
        type: String,
        maxlength: PRODUCT_LIMITS.specificationValue,
      },
      note: { type: String, maxlength: PRODUCT_LIMITS.specificationNote },
    },
    strictSubdocumentOptions,
  );

const publishedLocaleSpecificationSchema =
  new Schema<PublishedProductLocaleSpecification>(
    {
      key: nestedKey,
      label: {
        type: String,
        required: true,
        maxlength: PRODUCT_LIMITS.specificationLabel,
      },
      items: {
        type: [publishedLocaleSpecificationItemSchema],
        required: true,
        validate: productArrayValidators.specificationItems,
      },
    },
    strictSubdocumentOptions,
  );

const publishedLocaleMediaUsageSchema =
  new Schema<PublishedProductLocaleMediaUsage>(
    {
      mediaId: { type: Schema.Types.ObjectId, required: true },
      role: { type: String, required: true, enum: PRODUCT_MEDIA_ROLES },
      order: boundedOrder,
      locale: { type: String, validate: supportedLocaleValueValidator },
      alt: { type: String, maxlength: PRODUCT_LIMITS.mediaText },
      title: { type: String, maxlength: PRODUCT_LIMITS.mediaText },
      caption: { type: String, maxlength: PRODUCT_LIMITS.mediaCaption },
    },
    strictSubdocumentOptions,
  );

const publishedLocaleSeoSchema = new Schema<PublishedProductLocaleData["seo"]>(
  {
    title: {
      type: String,
      required: true,
      maxlength: PRODUCT_LIMITS.seoTitle,
    },
    description: { type: String, maxlength: PRODUCT_LIMITS.seoDescription },
    keywords: {
      type: [{ type: String, maxlength: PRODUCT_LIMITS.seoKeyword }],
      required: true,
      validate: productArrayValidators.seoKeywords,
    },
    openGraphTitle: { type: String, maxlength: PRODUCT_LIMITS.seoTitle },
    openGraphDescription: {
      type: String,
      maxlength: PRODUCT_LIMITS.seoDescription,
    },
    openGraphMediaId: Schema.Types.ObjectId,
  },
  strictSubdocumentOptions,
);

const publishedLocaleDataSchema = new Schema<PublishedProductLocaleData>(
  {
    name: { type: String, required: true, maxlength: PRODUCT_LIMITS.name },
    shortDescription: {
      type: String,
      required: true,
      maxlength: PRODUCT_LIMITS.shortDescription,
    },
    longDescriptionMarkdown: {
      type: String,
      maxlength: PRODUCT_LIMITS.longDescriptionMarkdown,
    },
    features: {
      type: [productFeatureSchema],
      required: true,
      validate: productArrayValidators.content,
    },
    advantages: {
      type: [productTextItemSchema],
      required: true,
      validate: productArrayValidators.content,
    },
    applications: {
      type: [productTextItemSchema],
      required: true,
      validate: productArrayValidators.content,
    },
    warrantyInformation: {
      type: String,
      maxlength: PRODUCT_LIMITS.warrantyInformation,
    },
    seo: { type: publishedLocaleSeoSchema, required: true },
    specifications: {
      type: [publishedLocaleSpecificationSchema],
      required: true,
      validate: productArrayValidators.specificationGroups,
    },
    mediaUsages: {
      type: [publishedLocaleMediaUsageSchema],
      required: true,
      validate: productArrayValidators.mediaUsages,
    },
  },
  strictSubdocumentOptions,
);

const publishedGlobalSchema = new Schema<PublishedProductGlobal>(
  {
    sourceVersion: { type: Number, required: true, min: 0 },
    sourceHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    globalRevision: { type: String, required: true, match: uuidPattern },
    publishedAt: { type: Date, required: true },
    data: { type: publishedGlobalDataSchema, required: true },
  },
  strictSubdocumentOptions,
);

const publishedLocaleSchema = new Schema<PublishedProductLocale>(
  {
    sourceVersion: { type: Number, required: true, min: 0 },
    sourceHash: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
    globalRevision: { type: String, required: true, match: uuidPattern },
    publicationRevision: { type: String, required: true, match: uuidPattern },
    publishedAt: { type: Date, required: true },
    data: { type: publishedLocaleDataSchema, required: true },
  },
  strictSubdocumentOptions,
);

const productSchema = new Schema<Product>(
  {
    slug: {
      type: String,
      required: true,
      lowercase: true,
      minlength: 2,
      maxlength: 140,
      validate: {
        validator: (value: string) => productSlugSchema.safeParse(value).success,
        message: "The product slug is invalid or reserved.",
      },
    },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    model: { type: String, trim: true, maxlength: PRODUCT_LIMITS.model },
    series: { type: String, trim: true, maxlength: PRODUCT_LIMITS.series },
    translations: {
      type: Map,
      of: productTranslationSchema,
      required: true,
      default: () => new Map(),
      validate: supportedLocaleValidator,
    },
    specifications: {
      type: [specificationGroupSchema],
      required: true,
      default: () => [],
      validate: productArrayValidators.specificationGroups,
    },
    mediaUsages: {
      type: [productMediaUsageSchema],
      required: true,
      default: () => [],
      validate: productArrayValidators.mediaUsages,
    },
    pageTemplate: {
      type: String,
      enum: ["standard", "topcon-premium"],
      required: true,
      default: "standard",
    },
    displayOrder: { ...boundedOrder, default: 0 },
    featured: { type: Boolean, required: true, default: false },
    publishedGlobal: publishedGlobalSchema,
    publishedSnapshots: {
      type: Map,
      of: publishedLocaleSchema,
      required: true,
      default: () => new Map(),
      validate: supportedLocaleValidator,
    },
    status: {
      type: String,
      enum: ["draft", "published", "archived", "deleting"],
      required: true,
      default: "draft",
    },
    firstPublishedAt: Date,
    createdBy: { type: Schema.Types.ObjectId, required: true, immutable: true },
    updatedBy: { type: Schema.Types.ObjectId, required: true },
  },
  {
    collection: "products",
    timestamps: true,
    versionKey: "version",
    optimisticConcurrency: true,
    strict: "throw",
  },
);

productSchema.pre("validate", function enforceProductDocumentSize() {
  const sizeBytes = mongoose.mongo.BSON.calculateObjectSize(this.toBSON());
  if (sizeBytes > PRODUCT_LIMITS.documentBytes) {
    this.invalidate(
      "$document",
      `The complete Product document cannot exceed ${PRODUCT_LIMITS.documentBytes} BSON bytes.`,
      sizeBytes,
      "productDocumentSize",
    );
  }
});

productSchema.index({ slug: 1 }, { unique: true });
productSchema.index({ status: 1, categoryId: 1, displayOrder: 1 });
productSchema.index({ status: 1, featured: 1, displayOrder: 1 });
productSchema.index({ categoryId: 1 });
productSchema.index({ updatedAt: -1 });

export const ProductModel: Model<Product> =
  (mongoose.models.Product as Model<Product> | undefined) ??
  mongoose.model<Product>("Product", productSchema);

export function productLocaleSnapshotMatchesGlobal(
  product: Pick<Product, "publishedGlobal" | "publishedSnapshots">,
  locale: string,
): boolean {
  const globalSnapshot = product.publishedGlobal;
  const localeSnapshot = product.publishedSnapshots.get(locale);
  return (
    globalSnapshot !== undefined &&
    localeSnapshot !== undefined &&
    localeSnapshot.globalRevision === globalSnapshot.globalRevision
  );
}

export function toProductAdminDto(product: ProductDocument): ProductAdminDto {
  const raw = product.toObject({
    flattenMaps: true,
    flattenObjectIds: true,
  });
  Reflect.deleteProperty(raw, "_id");
  const serialized: unknown = JSON.parse(
    JSON.stringify({ ...raw, id: product._id.toString() }),
  );
  return productAdminDtoSchema.parse({
    ...(serialized as Record<string, unknown>),
    ...publicationStateForDto(product),
  });
}
