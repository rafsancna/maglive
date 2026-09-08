import type { NewsAdminDto } from "@maglive/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewsWorkspace } from "@/admin/news/NewsWorkspace";

const api = vi.hoisted(() => ({
  archiveNews: vi.fn(),
  createNews: vi.fn(),
  deleteNews: vi.fn(),
  listNews: vi.fn(),
  publishNews: vi.fn(),
  unpublishNews: vi.fn(),
  updateNews: vi.fn(),
}));

vi.mock("@/admin/news/api", () => api);
vi.mock("@/admin/news/NewsWriter", () => ({
  NewsWriter: () => <div>Story editor canvas</div>,
}));
vi.mock("@/admin/languages/LanguageProvider", () => ({
  useLanguages: () => ({
    localeCodes: ["en", "zh"],
    languageByCode: {
      en: { code: "en", label: "English", nativeLabel: "English" },
      zh: {
        code: "zh",
        label: "Simplified Chinese",
        nativeLabel: "Chinese",
      },
    },
  }),
}));

const draft: NewsAdminDto = {
  id: "507f191e810c19729de860ea",
  slug: "solar-story",
  category: "company-news",
  authorName: "MAGLIVE Newsroom",
  featured: true,
  tags: ["solar", "project"],
  translations: {
    en: {
      title: "Solar Story",
      excerpt: "A concise summary of the solar project.",
      content: [
        {
          id: "0c645830-e521-4344-a3f2-8c1e32ffbf10",
          type: "paragraph",
          text: "Solar project update.",
        },
      ],
      seo: { keywords: [] },
    },
  },
  status: "draft",
  publishedSnapshots: {},
  localeStates: { en: "draft", zh: "incomplete" },
  createdBy: "507f191e810c19729de860eb",
  updatedBy: "507f191e810c19729de860eb",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-08T00:00:00.000Z",
  version: 3,
};

const published: NewsAdminDto = {
  ...draft,
  status: "published",
  publishedGlobal: {
    slug: draft.slug,
    category: draft.category,
    authorName: draft.authorName,
    featured: draft.featured,
    tags: draft.tags,
    publishedAt: "2026-09-09T00:00:00.000Z",
  },
  publishedSnapshots: {
    en: {
      publishedAt: "2026-09-09T00:00:00.000Z",
      data: draft.translations.en!,
    },
  },
  localeStates: { en: "published", zh: "incomplete" },
  firstPublishedAt: "2026-09-09T00:00:00.000Z",
  version: 4,
};

beforeEach(() => {
  vi.clearAllMocks();
  api.listNews.mockResolvedValue({
    items: [draft],
    pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
  });
  api.publishNews.mockResolvedValue(published);
});

describe("news management workspace", () => {
  it("lands on the news list and opens the editor only after Edit is selected", async () => {
    const user = userEvent.setup();
    render(<NewsWorkspace />);

    expect(
      await screen.findByRole("heading", { name: "All news" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Solar Story" })).toBeVisible();
    expect(screen.queryByText("News settings")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish EN" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      screen.getByRole("heading", { name: "News settings" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /All news/ })).toBeVisible();
  });

  it("publishes directly from the list without opening the editor", async () => {
    const user = userEvent.setup();
    render(<NewsWorkspace />);

    await user.click(await screen.findByRole("button", { name: "Publish EN" }));

    await waitFor(() =>
      expect(api.publishNews).toHaveBeenCalledWith(draft.id, {
        version: draft.version,
        locales: ["en"],
      }),
    );
    expect(screen.queryByText("News settings")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unpublish EN" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
