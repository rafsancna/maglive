import type { CategoryAdminDto } from "@maglive/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminApiError } from "@/admin/auth/api";
import { CategoryManager } from "@/admin/categories/CategoryManager";
import * as categoryApi from "@/admin/categories/api";
import * as mediaApi from "@/admin/media/api";

vi.mock("@/admin/categories/api", () => ({
  archiveCategory: vi.fn(),
  createCategory: vi.fn(),
  deleteCategory: vi.fn(),
  listCategories: vi.fn(),
  publishCategory: vi.fn(),
  reorderCategories: vi.fn(),
  unpublishCategory: vi.fn(),
  updateCategory: vi.fn(),
}));

vi.mock("@/admin/media/api", () => ({
  getMedia: vi.fn(),
  listMedia: vi.fn(),
}));

const hash = "a".repeat(64);
const otherHash = "b".repeat(64);
const timestamp = "2026-08-26T00:00:00.000Z";
const adminId = "507f1f77bcf86cd799439011";

function category(
  overrides: Partial<CategoryAdminDto> = {},
): CategoryAdminDto {
  return {
    id: "507f191e810c19729de860ea",
    slug: "modules",
    parentId: null,
    sortOrder: 0,
    translations: {
      en: { name: "Solar modules", seo: {} },
      zh: { name: "太阳能组件", seo: {} },
    },
    status: "active",
    publishedGlobal: {
      sourceVersion: 0,
      sourceHash: hash,
      globalRevision: "0f26d853-2a70-451a-b834-e3200385989a",
      publishedAt: timestamp,
      data: {
        slug: "modules",
        parentId: null,
        sortOrder: 0,
      },
    },
    publishedSnapshots: {
      en: {
        sourceVersion: 0,
        sourceHash: hash,
        globalRevision: "0f26d853-2a70-451a-b834-e3200385989a",
        publicationRevision: "ff4af680-2f89-48d6-93d0-0700a7360db8",
        publishedAt: timestamp,
        data: {
          name: "Solar modules",
          seo: { title: "Solar modules" },
        },
      },
    },
    workingGlobalHash: hash,
    workingLocaleHashes: { en: hash, zh: otherHash },
    localeStates: { en: "published", zh: "draft" },
    firstPublishedAt: timestamp,
    createdBy: adminId,
    updatedBy: adminId,
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
    ...overrides,
  };
}

const root = category();
const child = category({
  id: "507f1f77bcf86cd799439012",
  slug: "residential",
  parentId: root.id,
  translations: {
    en: { name: "Residential", seo: {} },
    zh: { name: "住宅", seo: {} },
  },
  publishedGlobal: undefined,
  publishedSnapshots: {},
  firstPublishedAt: undefined,
  localeStates: { en: "draft", zh: "draft" },
  version: 0,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(categoryApi.listCategories).mockResolvedValue([root, child]);
  vi.mocked(mediaApi.listMedia).mockResolvedValue({
    items: [],
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  });
  vi.mocked(mediaApi.getMedia).mockRejectedValue(
    new AdminApiError(404, "MEDIA_NOT_FOUND", "Media not found."),
  );
});

describe("category manager", () => {
  it("renders the hierarchy, registry-driven language states, and media picker", async () => {
    render(<CategoryManager />);

    expect(
      await screen.findByRole("heading", { name: "Product categories" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("complementary", { name: "Category hierarchy" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Solar modules/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("button", { name: /Residential/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /English published/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: /Simplified Chinese draft/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose image" })).toBeInTheDocument();
  });

  it("creates an English draft and exposes only root categories as parents", async () => {
    const created = category({
      id: "507f1f77bcf86cd799439013",
      slug: "storage",
      translations: { en: { name: "Energy storage", seo: {} } },
      publishedGlobal: undefined,
      publishedSnapshots: {},
      firstPublishedAt: undefined,
      localeStates: { en: "draft", zh: "incomplete" },
      version: 0,
    });
    vi.mocked(categoryApi.createCategory).mockResolvedValue(created);
    const user = userEvent.setup();
    render(<CategoryManager />);
    await screen.findByDisplayValue("modules");

    await user.click(screen.getByRole("button", { name: "New category" }));
    await user.type(screen.getByLabelText("Stable slug"), "storage");
    await user.type(screen.getByLabelText("Display name"), "Energy storage");
    const parent = screen.getByLabelText("Parent category");
    expect(parent).toHaveTextContent("Solar modules");
    expect(parent).not.toHaveTextContent("Residential");
    await user.click(screen.getByRole("button", { name: "Create draft" }));

    await waitFor(() => {
      expect(categoryApi.createCategory).toHaveBeenCalledWith({
        slug: "storage",
        parentId: null,
        sortOrder: 0,
        translations: {
          en: { name: "Energy storage", seo: {} },
        },
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Category draft created.",
    );
  });

  it("switches localized content and publishes only the selected language", async () => {
    const chinesePublished = category({
      publishedSnapshots: {
        ...root.publishedSnapshots,
        zh: {
          sourceVersion: 1,
          sourceHash: otherHash,
          globalRevision: "0f26d853-2a70-451a-b834-e3200385989a",
          publicationRevision: "adbc0da5-504d-45c6-a2e6-e0cf369adf94",
          publishedAt: timestamp,
          data: {
            name: "太阳能组件",
            seo: { title: "太阳能组件" },
          },
        },
      },
      localeStates: { en: "published", zh: "published" },
      version: 2,
    });
    vi.mocked(categoryApi.publishCategory).mockResolvedValue(chinesePublished);
    const user = userEvent.setup();
    render(<CategoryManager />);
    await screen.findByDisplayValue("Solar modules");

    await user.click(
      screen.getByRole("tab", { name: /Simplified Chinese draft/ }),
    );
    expect(screen.getByDisplayValue("太阳能组件")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Publish Simplified Chinese" }),
    );

    await waitFor(() => {
      expect(categoryApi.publishCategory).toHaveBeenCalledWith(root.id, {
        version: root.version,
        locales: ["zh"],
        promoteShared: false,
      });
    });
  });

  it("preserves edited fields when the API reports a stale version", async () => {
    vi.mocked(categoryApi.updateCategory).mockRejectedValue(
      new AdminApiError(409, "VERSION_CONFLICT", "Stale"),
    );
    const user = userEvent.setup();
    render(<CategoryManager />);
    const name = await screen.findByDisplayValue("Solar modules");

    await user.clear(name);
    await user.type(name, "High-efficiency modules");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "changed elsewhere",
    );
    expect(screen.getByDisplayValue("High-efficiency modules")).toBeInTheDocument();
  });

  it("selects a reusable image and saves localized contextual metadata", async () => {
    const reusableImage = {
      id: "507f1f77bcf86cd799439099",
      kind: "image" as const,
      url: "http://localhost:5000/uploads/images/category.png",
      mimeType: "image/png",
      width: 1200,
      height: 800,
      originalName: "category.png",
      sizeBytes: 1000,
      checksum: "c".repeat(64),
      defaultTranslations: { en: { alt: "Default solar image" } },
      status: "ready" as const,
      uploadedBy: adminId,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 0,
    };
    vi.mocked(mediaApi.listMedia).mockResolvedValue({
      items: [reusableImage],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
    vi.mocked(mediaApi.getMedia).mockResolvedValue(reusableImage);
    vi.mocked(categoryApi.updateCategory).mockResolvedValue({
      ...root,
      image: {
        mediaId: reusableImage.id,
        translations: { en: { alt: "Category solar array" } },
      },
      version: 2,
    });
    const user = userEvent.setup();
    render(<CategoryManager />);
    await screen.findByDisplayValue("Solar modules");

    await user.click(screen.getByRole("button", { name: "Choose image" }));
    await user.click(
      await screen.findByRole("button", { name: /category.png/ }),
    );
    const alt = screen.getByLabelText(/Contextual alt text/);
    await user.clear(alt);
    await user.type(alt, "Category solar array");
    await user.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(categoryApi.updateCategory).toHaveBeenCalledWith(
        root.id,
        expect.objectContaining({
          image: {
            mediaId: reusableImage.id,
            translations: { en: { alt: "Category solar array" } },
          },
        }),
      );
    });
  });
});
