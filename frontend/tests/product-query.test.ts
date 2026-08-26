import { describe, expect, it } from "vitest";
import { parseProductListQuery } from "@/admin/products/query";

describe("Product list URL query", () => {
  it("applies stable defaults for a clean Product list URL", () => {
    expect(parseProductListQuery(new URLSearchParams())).toEqual({
      success: true,
      query: {
        page: 1,
        limit: 20,
        locale: "en",
        sort: "updated-desc",
      },
    });
  });

  it("parses the complete allowlisted filter and sort contract", () => {
    const parameters = new URLSearchParams({
      page: "3",
      limit: "50",
      locale: "zh",
      sort: "name-asc",
      search: "TOPCon 630",
      categoryId: "507f191e810c19729de860ea",
      status: "published",
      localeState: "changes-pending",
      featured: "false",
    });

    expect(parseProductListQuery(parameters)).toEqual({
      success: true,
      query: {
        page: 3,
        limit: 50,
        locale: "zh",
        sort: "name-asc",
        search: "TOPCon 630",
        categoryId: "507f191e810c19729de860ea",
        status: "published",
        localeState: "changes-pending",
        featured: false,
      },
    });
  });

  it("rejects unknown, duplicated, and invalid URL values", () => {
    expect(
      parseProductListQuery(new URLSearchParams("unexpected=value")),
    ).toMatchObject({ success: false });
    expect(
      parseProductListQuery(new URLSearchParams("page=1&page=2")),
    ).toEqual({
      success: false,
      message: "The “page” filter can appear only once.",
    });
    expect(
      parseProductListQuery(new URLSearchParams("sort=constructor-desc")),
    ).toMatchObject({ success: false });
  });
});
