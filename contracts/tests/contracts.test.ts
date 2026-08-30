import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALE_REGISTRY,
  administratorPasswordSchema,
  apiErrorSchema,
  apiSuccessSchema,
  authenticatedSessionDtoSchema,
  categorySlugSchema,
  createCategorySlugBase,
  createCategoryRequestSchema,
  getLocaleMetadata,
  isLocaleCode,
  isProductTemplateId,
  legacyTemplateIdSchema,
  loginRequestSchema,
  adminMediaDtoSchema,
  mediaListQuerySchema,
  navigationDataSchema,
  updateMediaRequestSchema,
  objectIdStringSchema,
  paginationQuerySchema,
  publicCategoryTreeDtoSchema,
  productTemplateIdSchema
} from "../src/index.js";

describe("locale contracts", () => {
  it("derives immutable route codes and metadata from one registry", () => {
    expect(isLocaleCode("en")).toBe(true);
    expect(isLocaleCode("zh")).toBe(true);
    expect(isLocaleCode("zh-Hans")).toBe(false);
    expect(isLocaleCode("de")).toBe(true);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(getLocaleMetadata("zh")).toEqual(LOCALE_REGISTRY.zh);
    expect(LOCALE_REGISTRY.zh.languageTag).toBe("zh-Hans");
    expect(new Set(LOCALE_CODES).size).toBe(LOCALE_CODES.length);
    expect(Object.keys(LOCALE_REGISTRY)).toEqual(LOCALE_CODES);

    const detectionTagOwners = new Map<string, string>();
    for (const locale of LOCALE_CODES) {
      const metadata = LOCALE_REGISTRY[locale];
      expect(metadata.routeCode).toBe(locale);
      expect(LOCALE_CODES).toContain(metadata.fallback);
      expect(metadata.languageTag).not.toHaveLength(0);
      expect(metadata.nativeLabel).not.toHaveLength(0);
      const detectionTags = [
        metadata.routeCode.toLowerCase(),
        metadata.languageTag.toLowerCase(),
        ...metadata.acceptLanguageAliases.map((alias) => alias.toLowerCase())
      ];
      for (const tag of detectionTags) {
        const existingOwner = detectionTagOwners.get(tag);
        expect(existingOwner === undefined || existingOwner === locale).toBe(true);
        detectionTagOwners.set(tag, locale);
      }
    }
  });
});

describe("transport contracts", () => {
  it("coerces safe one-based pagination and enforces its upper bound", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(paginationQuerySchema.parse({ page: "2", limit: "100" })).toEqual({
      page: 2,
      limit: 100
    });
    expect(paginationQuerySchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });

  it("keeps ObjectIds and envelopes serializable", () => {
    const id = "507f1f77bcf86cd799439011";
    expect(objectIdStringSchema.parse(id)).toBe(id);
    expect(objectIdStringSchema.safeParse("not-an-object-id").success).toBe(false);

    const success = apiSuccessSchema(objectIdStringSchema).parse({ data: id });
    expect(success).toEqual({ data: id });

    const error = apiErrorSchema.parse({
      error: {
        code: "VALIDATION_FAILED",
        message: "The request is invalid.",
        requestId: "8a595af7-52c0-4fd0-8028-5f5a4a309509"
      }
    });
    expect(error.error.code).toBe("VALIDATION_FAILED");
  });
});

describe("navigation contracts", () => {
  it("upgrades stored navigation created before managed primary items", () => {
    const parsed = navigationDataSchema.parse({
      productCategories: [],
      featuredProducts: [],
      solutionCategories: [],
      featuredSolution: {
        id: "solution-fallback",
        label: { en: "Energy solutions" },
        href: "/projects",
      },
      cases: [],
      news: [],
      documents: [],
      services: [],
    });

    expect(parsed.primaryItems.map(({ id }) => id)).toEqual([
      "products",
      "solutions",
      "cases",
      "news",
      "documents",
      "services",
      "about",
      "contact",
    ]);
  });

  it("accepts translated custom top-level links", () => {
    const parsed = navigationDataSchema.shape.primaryItems.parse([
      {
        id: "careers",
        label: { en: "Careers", fr: "Carrières" },
        href: "/careers",
        visible: true,
        order: 8,
      },
    ]);

    expect(parsed[0]?.label.fr).toBe("Carrières");
  });
});

describe("administrator authentication contracts", () => {
  it("normalizes credentials and exposes only the safe authenticated session shape", () => {
    expect(
      loginRequestSchema.parse({
        email: " ADMIN@Example.COM ",
        password: "candidate"
      }).email
    ).toBe("admin@example.com");
    expect(administratorPasswordSchema.safeParse("short").success).toBe(false);

    const session = authenticatedSessionDtoSchema.parse({
      admin: {
        id: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        role: "admin"
      },
      csrfToken: "authenticated-csrf-token-value-000001"
    });
    expect(session.admin).not.toHaveProperty("passwordHash");
  });
});

describe("category contracts", () => {
  it("accepts well-formed managed locale keys and rejects reserved or malformed input", () => {
    expect(
      createCategoryRequestSchema.parse({
        slug: "solar-modules",
        translations: {
          en: { name: "Solar modules" },
          zh: { name: "太阳能组件" }
        }
      })
    ).toMatchObject({ parentId: null, sortOrder: 0 });
    expect(categorySlugSchema.safeParse("products").success).toBe(false);
    expect(categorySlugSchema.safeParse("Solar Modules").success).toBe(false);
    expect(
      createCategoryRequestSchema.safeParse({
        slug: "solar-modules",
        translations: { en: { name: "x".repeat(161) } }
      }).success
    ).toBe(false);
    expect(
      createCategoryRequestSchema.safeParse({
        slug: "solar-modules",
        translations: { DE: { name: "Solarmodule" } }
      }).success
    ).toBe(false);
  });

  it("validates recursive localized public trees without working fields", () => {
    const id = "507f1f77bcf86cd799439011";
    const parsed = publicCategoryTreeDtoSchema.parse({
      categories: [
        {
          id,
          slug: "modules",
          name: "Modules",
          parentId: null,
          sortOrder: 0,
          seo: { title: "Modules" },
          availableLocales: ["en"],
          breadcrumbs: [{ slug: "modules", name: "Modules" }],
          children: []
        }
      ]
    });
    expect(parsed.categories[0]).not.toHaveProperty("translations");
    expect(parsed.categories[0]?.children).toEqual([]);
  });
});

describe("category slug generation", () => {
  it("normalizes the English category name into a stable URL segment", () => {
    expect(createCategorySlugBase("Solar Modules")).toBe("solar-modules");
    expect(createCategorySlugBase("Café & Storage™")).toBe("cafe-storage");
    expect(createCategorySlugBase("Products")).toBe("products-category");
    expect(createCategorySlugBase("x".repeat(150))).toHaveLength(120);
  });
});

describe("media contracts", () => {
  it("accepts serializable metadata while excluding stored binary data", () => {
    const parsed = adminMediaDtoSchema.parse({
      id: "507f1f77bcf86cd799439011",
      kind: "image",
      url: "http://localhost:5000/uploads/images/media.png",
      mimeType: "image/png",
      width: 1200,
      height: 800,
      originalName: "module.png",
      sizeBytes: 2048,
      checksum: "a".repeat(64),
      defaultTranslations: {
        en: { title: "Module", alt: "Solar module" },
        zh: { title: "太阳能组件" },
      },
      status: "ready",
      uploadedBy: "507f1f77bcf86cd799439012",
      createdAt: "2026-08-26T06:00:00.000Z",
      updatedAt: "2026-08-26T06:00:00.000Z",
      version: 0,
    });
    expect(parsed).not.toHaveProperty("binary");
    expect(parsed).not.toHaveProperty("buffer");
    expect(parsed.defaultTranslations.zh?.title).toBe("太阳能组件");
  });

  it("bounds list filters and requires a real versioned metadata change", () => {
    expect(
      mediaListQuerySchema.parse({ page: "2", limit: "100", kind: "video" }),
    ).toMatchObject({ page: 2, limit: 100, kind: "video" });
    expect(mediaListQuerySchema.safeParse({ kind: "svg" }).success).toBe(false);
    expect(updateMediaRequestSchema.safeParse({ version: 0 }).success).toBe(false);
    expect(
      updateMediaRequestSchema.parse({
        version: 3,
        defaultTranslations: { en: { caption: "Installation overview" } },
      }),
    ).toMatchObject({ version: 3 });
  });
});

describe("template contracts", () => {
  it("distinguishes writable template IDs from bounded legacy IDs", () => {
    expect(productTemplateIdSchema.parse("standard")).toBe("standard");
    expect(isProductTemplateId("topcon-premium")).toBe(true);
    expect(isProductTemplateId("legacy-layout")).toBe(false);
    expect(legacyTemplateIdSchema.parse("legacy-layout")).toBe("legacy-layout");
    expect(legacyTemplateIdSchema.safeParse("../../component").success).toBe(false);
    expect(legacyTemplateIdSchema.safeParse("A".repeat(65)).success).toBe(false);
  });
});
