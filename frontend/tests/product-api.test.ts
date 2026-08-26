import { beforeEach, describe, expect, it, vi } from "vitest";
import * as adminApi from "@/admin/auth/api";
import {
  archiveProduct,
  deleteProduct,
  duplicateProduct,
  listProducts,
  productListPath,
  publishProduct,
  unpublishProduct,
} from "@/admin/products/api";

vi.mock("@/admin/auth/api", () => ({
  requestAdminData: vi.fn(),
  requestAdminMutation: vi.fn(),
}));

const productId = "507f191e810c19729de860ea";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.requestAdminData).mockResolvedValue({} as never);
  vi.mocked(adminApi.requestAdminMutation).mockResolvedValue({} as never);
});

describe("Product administrator API client", () => {
  it("serializes the complete list query in one canonical order", async () => {
    const query = {
      page: 2,
      limit: 50,
      locale: "zh" as const,
      sort: "name-desc" as const,
      search: "630 W & TOPCon",
      categoryId: "507f1f77bcf86cd799439011",
      status: "published" as const,
      localeState: "changes-pending" as const,
      featured: true,
    };
    const path =
      "/admin/products?page=2&limit=50&locale=zh&sort=name-desc" +
      "&search=630+W+%26+TOPCon&categoryId=507f1f77bcf86cd799439011" +
      "&status=published&localeState=changes-pending&featured=true";

    expect(productListPath(query)).toBe(path);
    await listProducts(query);

    expect(adminApi.requestAdminData).toHaveBeenCalledWith(
      path,
      expect.anything(),
    );
  });

  it("uses the protected lifecycle endpoints and preserves versions", async () => {
    await duplicateProduct(productId, 4);
    await publishProduct(productId, {
      version: 5,
      locales: ["en", "zh"],
      promoteShared: true,
    });
    await unpublishProduct(productId, { version: 6, locale: "zh" });
    await archiveProduct(productId, 7);
    await deleteProduct(productId, 8);

    expect(adminApi.requestAdminMutation).toHaveBeenNthCalledWith(
      1,
      `/admin/products/${productId}/duplicate`,
      expect.anything(),
      "POST",
      { version: 4 },
    );
    expect(adminApi.requestAdminMutation).toHaveBeenNthCalledWith(
      2,
      `/admin/products/${productId}/publish`,
      expect.anything(),
      "POST",
      { version: 5, locales: ["en", "zh"], promoteShared: true },
    );
    expect(adminApi.requestAdminMutation).toHaveBeenNthCalledWith(
      3,
      `/admin/products/${productId}/unpublish`,
      expect.anything(),
      "POST",
      { version: 6, locale: "zh" },
    );
    expect(adminApi.requestAdminMutation).toHaveBeenNthCalledWith(
      4,
      `/admin/products/${productId}/archive`,
      expect.anything(),
      "POST",
      { version: 7 },
    );
    expect(adminApi.requestAdminMutation).toHaveBeenNthCalledWith(
      5,
      `/admin/products/${productId}`,
      expect.anything(),
      "DELETE",
      { version: 8 },
    );
  });
});
