import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALE_REGISTRY,
  apiErrorSchema,
  apiSuccessSchema,
  getLocaleMetadata,
  isLocaleCode,
  isProductTemplateId,
  legacyTemplateIdSchema,
  objectIdStringSchema,
  paginationQuerySchema,
  productTemplateIdSchema
} from "../src/index.js";

describe("locale contracts", () => {
  it("derives immutable route codes and metadata from one registry", () => {
    expect(isLocaleCode("en")).toBe(true);
    expect(isLocaleCode("zh")).toBe(true);
    expect(isLocaleCode("zh-Hans")).toBe(false);
    expect(isLocaleCode("de")).toBe(false);
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
