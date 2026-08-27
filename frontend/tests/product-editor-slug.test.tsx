import type { CategoryAdminDto, ProductAdminDto } from "@maglive/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProductEditor } from "@/admin/products/ProductEditor";
import * as categoryApi from "@/admin/categories/api";
import * as productApi from "@/admin/products/api";
import { AdminApiError } from "@/admin/auth/api";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

vi.mock("@/admin/categories/api", () => ({
  listCategories: vi.fn(),
}));

vi.mock("@/admin/products/api", async (importOriginal) => {
  const original = await importOriginal<typeof productApi>();
  return { ...original, createProduct: vi.fn() };
});

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

const savedProduct: ProductAdminDto = {
  id: "507f191e810c19729de860ef",
  slug: "630-w-topcon-module",
  categoryId: category.id,
  translations: {
    en: {
      name: "630 W TOPCon Module",
      features: [],
      advantages: [],
      applications: [],
      seo: {},
    },
  },
  specifications: [],
  mediaUsages: [],
  pageTemplate: "standard",
  displayOrder: 0,
  featured: false,
  publishedSnapshots: {},
  workingGlobalHash: "b".repeat(64),
  workingLocaleHashes: { en: "c".repeat(64) },
  sharedState: "draft",
  localeStates: { en: "incomplete", zh: "incomplete" },
  status: "draft",
  createdBy: "507f1f77bcf86cd799439011",
  updatedBy: "507f1f77bcf86cd799439011",
  createdAt: timestamp,
  updatedAt: timestamp,
  version: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(categoryApi.listCategories).mockResolvedValue([category]);
  vi.mocked(productApi.createProduct).mockResolvedValue(savedProduct);
});

describe("automatic product slug", () => {
  it("keeps category and generated product slugs as separate URL segments", async () => {
    const user = userEvent.setup();
    render(<ProductEditor />);

    const categorySelect = await screen.findByLabelText("Category");
    await user.selectOptions(categorySelect, category.id);
    await user.type(
      screen.getByLabelText("English product name"),
      "630 W TOPCon Module",
    );

    expect(screen.getByLabelText("Product URL slug")).toHaveValue(
      "630-w-topcon-module",
    );
    expect(screen.getByText(/Public URL:/)).toHaveTextContent(
      "/products/solar-modules/630-w-topcon-module",
    );
    expect(screen.getByLabelText("Product URL slug")).toHaveAttribute("readonly");
  });

  it("shows one focused editor section at a time without losing entered values", async () => {
    const user = userEvent.setup();
    render(<ProductEditor />);

    const name = await screen.findByLabelText("English product name");
    await user.type(name, "Interactive draft");
    expect(screen.getByRole("group", { name: "Basic information" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "English content" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Content/ }));
    expect(screen.getByRole("group", { name: "English content" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Basic information" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Interactive draft");

    await user.click(screen.getByRole("tab", { name: /Basic/ }));
    expect(screen.getByLabelText("English product name")).toHaveValue("Interactive draft");
  });

  it("explains the real prerequisite when no active leaf category can accept a product", async () => {
    vi.mocked(categoryApi.listCategories).mockResolvedValueOnce([
      { ...category, status: "archived" },
    ]);
    render(<ProductEditor />);

    expect(
      await screen.findByText("No active leaf category is available"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Category")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Open Categories" })).toHaveAttribute(
      "href",
      "/admin/categories",
    );
  });

  it("creates a minimal incomplete draft and opens its persistent editor", async () => {
    const user = userEvent.setup();
    render(<ProductEditor />);

    await user.type(
      await screen.findByLabelText("English product name"),
      "630 W TOPCon Module",
    );
    await user.selectOptions(screen.getByLabelText("Category"), category.id);
    expect(screen.getByText("Ready to save")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Save Draft" })[0]!);

    await waitFor(() => {
      expect(productApi.createProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "630-w-topcon-module",
          categoryId: category.id,
          translations: {
            en: expect.objectContaining({ name: "630 W TOPCon Module" }),
          },
        }),
      );
    });
    expect(navigation.replace).toHaveBeenCalledWith(
      `/admin/products/${savedProduct.id}`,
    );
  });

  it("maps API body validation paths to the visible field and section", async () => {
    vi.mocked(productApi.createProduct).mockRejectedValueOnce(
      new AdminApiError(
        422,
        "VALIDATION_FAILED",
        "The request body is invalid.",
        [{
          path: "body.translations.en.name",
          code: "INVALID_VALUE",
          message: "The English name is not allowed.",
        }],
      ),
    );
    const user = userEvent.setup();
    render(<ProductEditor />);

    await user.type(
      await screen.findByLabelText("English product name"),
      "Blocked product",
    );
    await user.selectOptions(screen.getByLabelText("Category"), category.id);
    await user.click(screen.getAllByRole("button", { name: "Save Draft" })[0]!);

    expect(await screen.findByText("The English name is not allowed.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Content/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
  });
});
