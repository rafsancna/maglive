import { describe, expect, it } from "vitest";
import {
  PRODUCT_LIMITS,
  productAdminDtoSchema,
  productMediaUsageSchema,
  productPublicationValidationResultSchema,
  productSpecificationsSchema,
  productTranslationSchema,
  productWorkingDataSchema,
  publishProductRequestSchema,
  templateDataEnvelopeSchema,
} from "../src/index.js";

const categoryId = "507f1f77bcf86cd799439011";
const mediaId = "507f1f77bcf86cd799439012";

function workingProduct() {
  return {
    slug: "630w-topcon",
    categoryId,
    model: "MG-630N",
    series: "N-Type",
    translations: {
      en: {
        name: "630 W TOPCon module",
        shortDescription: "High-output bifacial solar module.",
        features: [{ key: "bifacial", title: "Bifacial generation" }],
        advantages: [],
        applications: [{ key: "utility", title: "Utility-scale arrays" }],
        seo: { keywords: ["TOPCon", "solar module"] },
      },
      zh: {
        name: "630瓦TOPCon组件",
        features: [],
        advantages: [],
        applications: [],
        seo: {},
      },
    },
    specifications: [
      {
        key: "electrical",
        order: 0,
        translations: { en: { label: "Electrical characteristics" } },
        items: [
          {
            key: "maximum-power",
            order: 0,
            value: "630",
            unit: "W",
            translations: { en: { label: "Maximum power" } },
          },
        ],
      },
    ],
    mediaUsages: [
      {
        mediaId,
        role: "hero" as const,
        order: 0,
        translations: { en: { alt: "630 W solar module" } },
      },
    ],
    pageTemplate: "topcon-premium" as const,
    displayOrder: 10,
    featured: true,
  };
}

describe("product contracts", () => {
  it("parses one bounded shape for multilingual modules and inverters", () => {
    const module = productWorkingDataSchema.parse(workingProduct());
    const inverter = productWorkingDataSchema.parse({
      ...workingProduct(),
      slug: "hybrid-inverter-x1",
      model: "X1-HYBRID",
      series: undefined,
      translations: {
        en: {
          name: "X1 hybrid inverter",
          features: [],
          advantages: [],
          applications: [],
          seo: {},
        },
      },
      specifications: [
        {
          key: "dc-input",
          order: 0,
          translations: { en: { label: "DC input" } },
          items: [
            {
              key: "maximum-voltage",
              order: 0,
              value: "1000",
              unit: "V",
              translations: { en: { label: "Maximum voltage" } },
            },
          ],
        },
      ],
      pageTemplate: "standard",
      featured: false,
    });

    expect(module.specifications[0]?.key).toBe("electrical");
    expect(inverter.specifications[0]?.key).toBe("dc-input");
    expect(inverter).not.toHaveProperty("templateData");
  });

  it("rejects unsupported locales, roles, duplicate keys, and array limits", () => {
    expect(
      productWorkingDataSchema.safeParse({
        ...workingProduct(),
        translations: { de: { name: "Produkt" } },
      }).success,
    ).toBe(false);
    expect(
      productMediaUsageSchema.safeParse({
        mediaId,
        role: "component",
        order: 0,
      }).success,
    ).toBe(false);
    expect(
      productSpecificationsSchema.safeParse([
        workingProduct().specifications[0],
        workingProduct().specifications[0],
      ]).success,
    ).toBe(false);
    expect(
      productTranslationSchema.safeParse({
        name: "Oversized feature list",
        features: Array.from(
          { length: PRODUCT_LIMITS.contentItemsPerList + 1 },
          (_, index) => ({ key: `feature-${index}`, title: "Feature" }),
        ),
      }).success,
    ).toBe(false);
    expect(
      productWorkingDataSchema.safeParse({
        ...workingProduct(),
        specifications: Array.from(
          { length: PRODUCT_LIMITS.specificationGroups + 1 },
          (_, index) => ({
            ...workingProduct().specifications[0],
            key: `group-${index}`,
          }),
        ),
      }).success,
    ).toBe(false);
    expect(
      productWorkingDataSchema.safeParse({
        ...workingProduct(),
        specifications: [
          {
            ...workingProduct().specifications[0],
            items: Array.from(
              { length: PRODUCT_LIMITS.specificationItemsPerGroup + 1 },
              (_, index) => ({
                ...workingProduct().specifications[0]!.items[0],
                key: `item-${index}`,
              }),
            ),
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      productWorkingDataSchema.safeParse({
        ...workingProduct(),
        mediaUsages: Array.from(
          { length: PRODUCT_LIMITS.mediaUsages + 1 },
          (_, index) => ({
            mediaId,
            role: "gallery",
            order: index,
          }),
        ),
      }).success,
    ).toBe(false);
    expect(
      productWorkingDataSchema.safeParse({
        ...workingProduct(),
        translations: {
          en: {
            name: "Too many keywords",
            seo: {
              keywords: Array.from(
                { length: PRODUCT_LIMITS.seoKeywords + 1 },
                (_, index) => `keyword-${index}`,
              ),
            },
          },
        },
      }).success,
    ).toBe(false);
  });

  it("keeps future template data unknown but JSON-safe, depth-bound, and size-bound", () => {
    expect(
      templateDataEnvelopeSchema.parse({
        schemaVersion: 1,
        data: { accent: "green", sections: [{ key: "performance" }] },
      }).data,
    ).toEqual({ accent: "green", sections: [{ key: "performance" }] });

    let nested: unknown = "leaf";
    for (let depth = 0; depth <= PRODUCT_LIMITS.templateDataDepth; depth += 1) {
      nested = { child: nested };
    }
    expect(
      templateDataEnvelopeSchema.safeParse({ schemaVersion: 1, data: nested })
        .success,
    ).toBe(false);
    expect(
      templateDataEnvelopeSchema.safeParse({
        schemaVersion: 1,
        data: "x".repeat(PRODUCT_LIMITS.templateDataBytes),
      }).success,
    ).toBe(false);
  });

  it("defines an API DTO with JSON objects and without storage or binary fields", () => {
    const timestamp = "2026-08-26T09:00:00.000Z";
    const rawDto = {
      ...workingProduct(),
      id: "507f1f77bcf86cd799439013",
      publishedSnapshots: {},
      workingGlobalHash: "a".repeat(64),
      workingLocaleHashes: {},
      sharedState: "draft",
      localeStates: { en: "draft", zh: "incomplete" },
      status: "draft",
      createdBy: "507f1f77bcf86cd799439014",
      updatedBy: "507f1f77bcf86cd799439014",
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 0,
      storage: { provider: "local", key: "absolute/not-allowed" },
      binary: "not-allowed",
    };
    expect(productAdminDtoSchema.safeParse(rawDto).success).toBe(false);
    const dto = productAdminDtoSchema.parse({
      ...workingProduct(),
      id: rawDto.id,
      publishedSnapshots: {},
      workingGlobalHash: "a".repeat(64),
      workingLocaleHashes: {},
      sharedState: "draft",
      localeStates: { en: "draft", zh: "incomplete" },
      status: "draft",
      createdBy: rawDto.createdBy,
      updatedBy: rawDto.updatedBy,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 0,
    });

    expect(dto.translations).not.toBeInstanceOf(Map);
    expect(dto).not.toHaveProperty("storage");
    expect(dto).not.toHaveProperty("binary");
    expect(JSON.stringify(dto)).not.toContain("ObjectId");
  });

  it("defines strict publication commands and field-addressable reports", () => {
    expect(
      publishProductRequestSchema.parse({
        version: 3,
        locales: ["en", "zh"],
      }),
    ).toEqual({ version: 3, locales: ["en", "zh"], promoteShared: false });
    expect(
      publishProductRequestSchema.safeParse({
        version: 3,
        locales: ["en", "en"],
      }).success,
    ).toBe(false);

    const report = productPublicationValidationResultSchema.parse({
      publishable: false,
      errors: [
        {
          severity: "error",
          path: "translations.zh.shortDescription",
          code: "PRODUCT_SHORT_DESCRIPTION_REQUIRED",
          message: "A localized short description is required.",
        },
      ],
      warnings: [
        {
          severity: "warning",
          path: "translations.zh.seo.title",
          code: "SEO_TITLE_DERIVED",
          message: "The SEO title will be derived.",
        },
      ],
    });
    expect(report.errors[0]?.severity).toBe("error");
    expect(report.warnings[0]?.severity).toBe("warning");
  });
});
