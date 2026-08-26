import type {
  AdminProductListDto,
  AdminProductListItem,
  CategoryAdminDto,
} from "@maglive/contracts";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError } from "@/admin/auth/api";
import { ProductWorkspace } from "@/admin/products/ProductWorkspace";
import * as categoryApi from "@/admin/categories/api";
import * as productApi from "@/admin/products/api";

const navigation = vi.hoisted(() => ({
  query: "",
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams(navigation.query),
}));

vi.mock("@/admin/categories/api", () => ({
  listCategories: vi.fn(),
}));

vi.mock("@/admin/products/api", async (importOriginal) => {
  const original = await importOriginal<typeof productApi>();
  return {
    ...original,
    archiveProduct: vi.fn(),
    deleteProduct: vi.fn(),
    duplicateProduct: vi.fn(),
    listProducts: vi.fn(),
    publishProduct: vi.fn(),
    unpublishProduct: vi.fn(),
  };
});

const timestamp = "2026-08-26T07:30:00.000Z";
const categoryId = "507f191e810c19729de860ea";
const hash = "a".repeat(64);
const adminId = "507f1f77bcf86cd799439011";

const category: CategoryAdminDto = {
  id: categoryId,
  slug: "solar-modules",
  parentId: null,
  sortOrder: 0,
  translations: {
    en: { name: "Solar modules", seo: {} },
    zh: { name: "太阳能组件", seo: {} },
  },
  status: "active",
  publishedSnapshots: {},
  workingGlobalHash: hash,
  workingLocaleHashes: { en: hash, zh: hash },
  localeStates: { en: "draft", zh: "draft" },
  createdBy: adminId,
  updatedBy: adminId,
  createdAt: timestamp,
  updatedAt: timestamp,
  version: 0,
};

function completeness(complete: boolean) {
  return {
    hasTranslation: complete,
    hasName: complete,
    hasShortDescription: complete,
    hasLongDescription: complete,
    localizedSpecificationGroups: complete ? 1 : 0,
    requiredSpecificationGroups: 1,
    complete,
  };
}

function product(
  overrides: Partial<AdminProductListItem> = {},
): AdminProductListItem {
  return {
    id: "507f1f77bcf86cd799439012",
    slug: "630w-topcon",
    name: "630W TOPCon module",
    nameLocale: "en",
    names: { en: "630W TOPCon module", zh: "630W TOPCon 组件" },
    model: "MG-630",
    series: "Apex",
    categoryId,
    pageTemplate: "standard",
    displayOrder: 10,
    featured: true,
    status: "published",
    sharedState: "changes-pending",
    localeStates: { en: "published", zh: "draft" },
    translationCompleteness: {
      en: completeness(true),
      zh: completeness(true),
    },
    publishedLocales: ["en"],
    canDeletePermanently: false,
    updatedAt: timestamp,
    version: 4,
    ...overrides,
  };
}

const publishedProduct = product();
const draftProduct = product({
  id: "507f1f77bcf86cd799439013",
  slug: "residential-inverter",
  name: "Residential inverter",
  names: { en: "Residential inverter" },
  model: undefined,
  series: undefined,
  featured: false,
  status: "draft",
  sharedState: "draft",
  localeStates: { en: "draft", zh: "incomplete" },
  translationCompleteness: {
    en: completeness(true),
    zh: completeness(false),
  },
  publishedLocales: [],
  canDeletePermanently: true,
  version: 1,
});

function list(
  items: AdminProductListItem[] = [publishedProduct, draftProduct],
  page = 1,
  totalPages = 2,
): AdminProductListDto {
  return {
    items,
    pagination: {
      page,
      limit: 20,
      total: items.length === 0 ? 0 : 22,
      totalPages: items.length === 0 ? 0 : totalPages,
    },
    collectionCounts: {
      all: 22,
      draft: 11,
      published: 9,
      archived: 2,
      featured: 4,
    },
  };
}

beforeEach(() => {
  vi.unstubAllGlobals();
  navigation.query = "";
  navigation.push.mockReset();
  navigation.replace.mockReset();
  vi.clearAllMocks();
  vi.mocked(categoryApi.listCategories).mockResolvedValue([category]);
  vi.mocked(productApi.listProducts).mockResolvedValue(list());
  vi.mocked(productApi.duplicateProduct).mockResolvedValue({} as never);
  vi.mocked(productApi.publishProduct).mockResolvedValue({} as never);
  vi.mocked(productApi.unpublishProduct).mockResolvedValue({} as never);
  vi.mocked(productApi.archiveProduct).mockResolvedValue({} as never);
  vi.mocked(productApi.deleteProduct).mockResolvedValue(undefined);
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("Product workspace", () => {
  it("renders the localized summary and drives every filter and sort through the URL", async () => {
    const user = userEvent.setup();
    render(<ProductWorkspace />);

    expect(
      await screen.findByRole("heading", { name: "Products" }),
    ).toBeInTheDocument();
    expect(screen.getByText("630W TOPCon module")).toBeInTheDocument();
    expect(screen.getByText("630w-topcon")).toBeInTheDocument();
    expect(screen.getByText("MG-630 · Apex")).toBeInTheDocument();
    const publishedRow = screen.getByText("630W TOPCon module").closest("tr");
    expect(publishedRow).not.toBeNull();
    expect(within(publishedRow as HTMLElement).getByText("Solar modules"))
      .toBeInTheDocument();
    expect(within(publishedRow as HTMLElement).getByText("Featured"))
      .toBeInTheDocument();
    expect(
      within(publishedRow as HTMLElement).getByText(/ZH: 630W TOPCon 组件/),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search Products"), "topcon 630");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await user.selectOptions(screen.getByLabelText("Category"), categoryId);
    await user.selectOptions(screen.getByLabelText("Global status"), "published");
    await user.selectOptions(screen.getByLabelText("Language"), "zh");
    await user.selectOptions(
      screen.getByLabelText("Language state"),
      "changes-pending",
    );
    await user.selectOptions(screen.getByLabelText("Featured"), "false");
    for (const sort of [
      "updated-asc",
      "order-asc",
      "order-desc",
      "name-asc",
      "name-desc",
    ]) {
      await user.selectOptions(screen.getByLabelText("Sort"), sort);
    }

    const paths = navigation.push.mock.calls.map(([path]) => path);
    expect(paths).toEqual(
      expect.arrayContaining([
        expect.stringContaining("search=topcon+630"),
        expect.stringContaining(`categoryId=${categoryId}`),
        expect.stringContaining("status=published"),
        expect.stringContaining("locale=zh"),
        expect.stringContaining("localeState=changes-pending"),
        expect.stringContaining("featured=false"),
        expect.stringContaining("sort=updated-asc"),
        expect.stringContaining("sort=order-asc"),
        expect.stringContaining("sort=order-desc"),
        expect.stringContaining("sort=name-asc"),
        expect.stringContaining("sort=name-desc"),
      ]),
    );
  });

  it("restores URL state, paginates, and corrects a page beyond the last page", async () => {
    navigation.query =
      `page=2&limit=20&locale=zh&sort=order-asc&categoryId=${categoryId}` +
      "&status=draft&localeState=incomplete&featured=true&search=inverter";
    vi.mocked(productApi.listProducts).mockResolvedValue(list([draftProduct], 2, 2));
    const user = userEvent.setup();
    const { rerender } = render(<ProductWorkspace />);

    await waitFor(() => {
      expect(productApi.listProducts).toHaveBeenCalledWith({
        page: 2,
        limit: 20,
        locale: "zh",
        sort: "order-asc",
        categoryId,
        status: "draft",
        localeState: "incomplete",
        featured: true,
        search: "inverter",
      });
    });
    expect(screen.getByLabelText("Search Products")).toHaveValue("inverter");
    expect(screen.getByLabelText("Language")).toHaveValue("zh");
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(navigation.push).toHaveBeenLastCalledWith(
      expect.stringContaining("page=1"),
      { scroll: false },
    );

    navigation.query = "page=9&limit=20&locale=en&sort=updated-desc";
    vi.mocked(productApi.listProducts).mockResolvedValue(list([publishedProduct], 3, 3));
    rerender(<ProductWorkspace />);
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        expect.stringContaining("page=3"),
        { scroll: false },
      );
    });
  });

  it("runs lifecycle actions with confirmation and refreshes only Product data", async () => {
    const user = userEvent.setup();
    render(<ProductWorkspace />);
    await screen.findByText("630W TOPCon module");
    expect(categoryApi.listCategories).toHaveBeenCalledTimes(1);

    let publishedRow = screen.getByText("630W TOPCon module").closest("tr");
    expect(publishedRow).not.toBeNull();
    const keyboardMenu = within(publishedRow as HTMLElement).getByText("Actions");
    keyboardMenu.focus();
    await user.keyboard("{Enter}");
    const publishedActions = within(publishedRow as HTMLElement);
    expect(publishedActions.getByRole("link", { name: "Edit Product" }))
      .toHaveAttribute("href", `/admin/products/${publishedProduct.id}`);
    expect(
      publishedActions.getByRole("button", { name: "Preview unavailable" }),
    ).toBeDisabled();
    const publishButton = publishedActions.getByRole("button", {
      name: "Publish Simplified Chinese",
    });
    publishButton.focus();
    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(productApi.publishProduct).toHaveBeenCalledWith(
        publishedProduct.id,
        {
          version: 4,
          locales: ["en", "zh"],
          promoteShared: true,
        },
      ),
    );
    publishedRow = (await screen.findByText("630W TOPCon module")).closest("tr");
    expect(publishedRow).not.toBeNull();
    const unpublishMenu = within(publishedRow as HTMLElement).getByText("Actions");
    unpublishMenu.focus();
    await user.keyboard("{Enter}");
    const unpublishButton = within(publishedRow as HTMLElement).getByRole(
      "button",
      { name: "Unpublish English" },
    );
    unpublishButton.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(productApi.unpublishProduct).toHaveBeenCalledWith(
        publishedProduct.id,
        { version: 4, locale: "en" },
      );
    });
    publishedRow = (await screen.findByText("630W TOPCon module")).closest("tr");
    expect(publishedRow).not.toBeNull();
    const archiveMenu = within(publishedRow as HTMLElement).getByText("Actions");
    archiveMenu.focus();
    await user.keyboard("{Enter}");
    const archiveButton = within(publishedRow as HTMLElement).getByRole(
      "button",
      { name: "Archive Product" },
    );
    archiveButton.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(productApi.archiveProduct).toHaveBeenCalledWith(
        publishedProduct.id,
        4,
      );
    });

    let draftRow = (await screen.findByText("Residential inverter")).closest("tr");
    expect(draftRow).not.toBeNull();
    const duplicateMenu = within(draftRow as HTMLElement).getByText("Actions");
    duplicateMenu.focus();
    await user.keyboard("{Enter}");
    const duplicateButton = within(draftRow as HTMLElement).getByRole(
      "button",
      { name: "Duplicate as draft" },
    );
    duplicateButton.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(productApi.duplicateProduct).toHaveBeenCalledWith(
        draftProduct.id,
        1,
      );
    });
    draftRow = (await screen.findByText("Residential inverter")).closest("tr");
    expect(draftRow).not.toBeNull();
    const deleteMenu = within(draftRow as HTMLElement).getByText("Actions");
    deleteMenu.focus();
    await user.keyboard("{Enter}");
    const deleteButton = within(draftRow as HTMLElement).getByRole(
      "button",
      { name: "Permanently delete draft" },
    );
    deleteButton.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(productApi.deleteProduct).toHaveBeenCalledWith(draftProduct.id, 1);
    });
    expect(categoryApi.listCategories).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(productApi.listProducts).mock.calls.length,
    ).toBeGreaterThan(5);
    expect(confirm).toHaveBeenCalledTimes(5);
  });

  it("shows no-results, invalid URL, expired-session, and unavailable states", async () => {
    vi.mocked(productApi.listProducts).mockResolvedValue(list([], 1, 0));
    const { unmount } = render(<ProductWorkspace />);
    expect(
      await screen.findByText("No Products match these filters"),
    ).toBeInTheDocument();
    unmount();

    navigation.query = "page=0";
    render(<ProductWorkspace />);
    expect(await screen.findByText("Invalid Product list URL")).toBeInTheDocument();
    unmount();

    navigation.query = "";
    vi.mocked(productApi.listProducts).mockRejectedValueOnce(
      new AdminApiError(401, "SESSION_EXPIRED", "Expired"),
    );
    render(<ProductWorkspace />);
    expect(await screen.findByText("Session expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in again" })).toHaveAttribute(
      "href",
      "/admin/login?returnTo=%2Fadmin%2Fproducts",
    );
    unmount();

    vi.mocked(productApi.listProducts).mockRejectedValueOnce(
      new AdminApiError(503, "API_UNAVAILABLE", "Unavailable"),
    );
    render(<ProductWorkspace />);
    expect(await screen.findByText("API unavailable")).toBeInTheDocument();
  });

  it("keeps conflict and publication-validation failures visible and recoverable", async () => {
    vi.mocked(productApi.archiveProduct).mockRejectedValueOnce(
      new AdminApiError(409, "VERSION_CONFLICT", "Stale"),
    );
    vi.mocked(productApi.publishProduct).mockRejectedValueOnce(
      new AdminApiError(422, "PRODUCT_NOT_PUBLISHABLE", "Incomplete"),
    );
    const user = userEvent.setup();
    render(<ProductWorkspace />);
    await screen.findByText("630W TOPCon module");
    const row = screen.getByText("630W TOPCon module").closest("tr");
    expect(row).not.toBeNull();
    const rowQueries = within(row as HTMLElement);
    await user.click(rowQueries.getByText("Actions"));
    await user.click(
      rowQueries.getByRole("button", { name: "Archive Product" }),
    );
    await waitFor(() => {
      expect(productApi.archiveProduct).toHaveBeenCalledWith(
        publishedProduct.id,
        4,
      );
    });
    expect(await screen.findByText("Product changed")).toBeInTheDocument();
    await user.click(
      rowQueries.getByRole("button", { name: "Publish Simplified Chinese" }),
    );
    expect(await screen.findByText("Publication blocked")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Refresh Product list" }),
    ).toBeInTheDocument();
  });
});
