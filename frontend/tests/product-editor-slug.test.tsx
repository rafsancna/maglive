import type { CategoryAdminDto } from "@maglive/contracts";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductEditor } from "@/admin/products/ProductEditor";
import * as categoryApi from "@/admin/categories/api";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/admin/categories/api", () => ({
  listCategories: vi.fn(),
}));

const timestamp = "2026-08-27T00:00:00.000Z";
const category: CategoryAdminDto = {
  id: "507f191e810c19729de860ea",
  slug: "solar-modules",
  parentId: null,
  sortOrder: 0,
  translations: { en: { name: "Solar modules", seo: {} } },
  status: "active",
  publishedSnapshots: {},
  workingGlobalHash: "a".repeat(64),
  workingLocaleHashes: { en: "a".repeat(64) },
  localeStates: { en: "draft", zh: "incomplete" },
  createdBy: "507f1f77bcf86cd799439011",
  updatedBy: "507f1f77bcf86cd799439011",
  createdAt: timestamp,
  updatedAt: timestamp,
  version: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(categoryApi.listCategories).mockResolvedValue([category]);
});

describe("automatic product slug", () => {
  it("keeps category and generated product slugs as separate URL segments", async () => {
    const user = userEvent.setup();
    render(<ProductEditor />);

    const categorySelect = await screen.findByLabelText("Category");
    await user.selectOptions(categorySelect, category.id);
    await user.type(screen.getByLabelText("Name"), "630 W TOPCon Module");

    expect(screen.getByLabelText("Product URL slug")).toHaveValue(
      "630-w-topcon-module",
    );
    expect(screen.getByText(/Public URL:/)).toHaveTextContent(
      "/products/solar-modules/630-w-topcon-module",
    );
    expect(screen.getByLabelText("Product URL slug")).toHaveAttribute("readonly");
  });
});
