import { describe, expect, it } from "vitest";
import { calculateSeoScore } from "../src/services/seoScoringService.js";

describe("SEO scoring", () => {
  it("scores localized content with understandable checks", () => {
    const result = calculateSeoScore({
      contentType: "product",
      locale: "en",
      title: "High efficiency solar module for commercial rooftops",
      description: "High efficiency solar module for commercial rooftops with dependable output, documented performance, and installation support for modern energy projects.",
      focusKeyphrase: "solar module",
      slug: "commercial-solar-module",
      content: "Our solar module is built for commercial rooftops.",
      headings: ["h1", "h2"],
      images: [{ alt: "Commercial solar module" }],
      internalLinks: 3,
      canonicalUrl: "https://example.com/en/products/modules/commercial-solar-module",
      robots: { index: true, follow: true },
      availableLocales: ["en", "zh"],
      publishedLocales: ["en", "zh"],
      hreflangLocales: ["en", "zh"],
      expectedSchema: "Product",
      hasStructuredData: true,
    });

    expect(result.score).toBeGreaterThanOrEqual(90);
    expect(result.issues.some((item) => item.status === "passed")).toBe(true);
    expect(result.issues.some((item) => item.source === "yoast")).toBe(true);
    expect(result.locale).toBe("en");
  });

  it("handles Chinese phrase matching without English tokenization", () => {
    const result = calculateSeoScore({
      contentType: "product",
      locale: "zh",
      title: "高效太阳能组件",
      description: "适用于商业屋顶的高效太阳能组件，提供稳定的发电性能和技术支持。",
      focusKeyphrase: "太阳能组件",
      slug: "solar-module",
      content: "这款太阳能组件适用于商业屋顶。",
      headings: ["h1", "h2"],
      images: [],
      internalLinks: 2,
      canonicalUrl: "https://example.com/zh/products/modules/solar-module",
      robots: { index: true, follow: true },
      availableLocales: ["en", "zh"],
      publishedLocales: ["en", "zh"],
      hreflangLocales: ["en", "zh"],
      expectedSchema: "Product",
      hasStructuredData: true,
    });

    expect(result.issues.find((item) => item.key === "keyphrase.used")?.status).toBe("passed");
    expect(result.issues.some((item) => item.source === "yoast")).toBe(false);
  });
});
