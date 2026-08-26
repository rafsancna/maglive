import { describe, expect, it } from "vitest";
import {
  publicProductDetailDtoSchema,
  publicProductDetailQuerySchema,
  publicProductListQuerySchema,
  publicProductVisibilityDtoSchema,
  publicSitemapEntriesQuerySchema,
} from "../src/index.js";

const productId = "507f1f77bcf86cd799439011";
const categoryId = "507f1f77bcf86cd799439012";
const revision = "4e160a0c-3846-4c67-8c48-d1aa18ace83b";
const updatedAt = "2026-08-26T09:00:00.000Z";

function summary() {
  return {
    id: productId,
    slug: "630w-topcon",
    name: "630 W TOPCon module",
    shortDescription: "High-output bifacial module.",
    model: "MG-630N",
    category: {
      id: categoryId,
      slug: "solar-modules",
      name: "Solar modules",
      breadcrumbs: [
        { slug: "solar", name: "Solar" },
        { slug: "solar-modules", name: "Solar modules" },
      ],
    },
    pageTemplate: "standard",
    featured: true,
    publicationRevision: revision,
    updatedAt,
    availableLocales: ["en", "zh"],
    fallbackFields: [],
  };
}

describe("public Product contracts", () => {
  it("defines strict bounded list/detail/visibility request boundaries", () => {
    expect(publicProductListQuerySchema.parse({ locale: "zh" })).toEqual({
      locale: "zh",
      page: 1,
      limit: 20,
      sort: "order-asc",
    });
    expect(
      publicProductListQuerySchema.parse({
        locale: "en",
        page: "2",
        limit: "100",
        category: "solar-modules",
        featured: "false",
        sort: "name-desc",
      }),
    ).toMatchObject({ page: 2, limit: 100, featured: false });
    expect(
      publicProductListQuerySchema.safeParse({
        locale: "en",
        includeDraft: "true",
      }).success,
    ).toBe(false);
    expect(
      publicProductDetailQuerySchema.safeParse({
        locale: "en",
        publicationRevision: "obsolete",
      }).success,
    ).toBe(false);
    expect(publicSitemapEntriesQuerySchema.parse({})).toEqual({
      page: 1,
      limit: 20,
    });
  });

  it("accepts one complete snapshot-composed detail without private fields", () => {
    const detail = publicProductDetailDtoSchema.parse({
      ...summary(),
      longDescriptionMarkdown: "Published long description.",
      features: [],
      advantages: [],
      applications: [],
      seo: { title: "630 W TOPCon module", keywords: [] },
      specifications: [
        {
          key: "electrical",
          label: "Electrical",
          order: 0,
          items: [
            {
              key: "power",
              label: "Power",
              order: 0,
              value: "630",
              unit: "W",
            },
          ],
        },
      ],
      media: [],
      relatedProducts: [],
    });
    expect(detail.specifications[0]?.items[0]?.value).toBe("630");
    expect(
      publicProductDetailDtoSchema.safeParse({
        ...detail,
        translations: { en: { name: "private" } },
      }).success,
    ).toBe(false);
    expect(
      publicProductDetailDtoSchema.safeParse({
        ...detail,
        storage: { key: "private" },
      }).success,
    ).toBe(false);
  });

  it("requires a locale-scoped opaque revision at the visibility boundary", () => {
    expect(
      publicProductVisibilityDtoSchema.parse({
        slug: "630w-topcon",
        locale: "zh",
        publicationRevision: revision,
        updatedAt,
        availableLocales: ["en", "zh"],
      }).publicationRevision,
    ).toBe(revision);
  });
});
