import { describe, expect, it } from "vitest";
import { productPath } from "@/lib/product-path";

describe("product path", () => {
  it("keeps the original category and product slugs as separate segments", () => {
    expect(
      productPath({
        slug: "630-w-topcon-module",
        category: { slug: "solar-modules" },
      }),
    ).toBe("/products/solar-modules/630-w-topcon-module");
  });
});
