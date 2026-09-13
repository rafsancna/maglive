import { updateNavigationRequestSchema, type LanguageDto, type NavigationAdminDto, type NewsAdminDto } from "@maglive/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/admin/languages/LanguageProvider";
import { NavigationManager } from "@/admin/navigation/NavigationManager";
import * as languageApi from "@/admin/languages/api";
import * as navigationApi from "@/admin/navigation/api";
import * as newsApi from "@/admin/news/api";

vi.mock("@/admin/languages/api", () => ({
  getLanguages: vi.fn(),
}));

vi.mock("@/admin/navigation/api", () => ({
  getNavigation: vi.fn(),
  updateNavigation: vi.fn(),
}));

vi.mock("@/admin/news/api", () => ({
  listNews: vi.fn(),
}));

const languages: readonly LanguageDto[] = [
  {
    code: "en",
    languageTag: "en",
    acceptLanguageAliases: [],
    direction: "ltr",
    fallback: "en",
    label: "English",
    nativeLabel: "English",
    builtIn: true,
  },
  {
    code: "zh",
    languageTag: "zh-Hans",
    acceptLanguageAliases: ["zh-CN", "zh-SG"],
    direction: "ltr",
    fallback: "en",
    label: "Simplified Chinese",
    nativeLabel: "简体中文",
    builtIn: true,
  },
  {
    code: "fr",
    languageTag: "fr-FR",
    acceptLanguageAliases: ["fr-CA"],
    direction: "ltr",
    fallback: "en",
    label: "French",
    nativeLabel: "Français",
    builtIn: false,
  },
];

const navigation: NavigationAdminDto = {
  primaryItems: [
    {
      id: "products",
      label: { en: "Products", zh: "产品" },
      href: "/products",
      menu: "products",
      visible: true,
      order: 0,
    },
  ],
  productCategories: [
    {
      id: "solar-modules",
      accent: "01",
      label: { en: "Solar modules", zh: "太阳能组件" },
      description: { en: "High-output modules", zh: "高功率组件" },
      href: "/products",
      products: [],
      visible: true,
      order: 0,
    },
  ],
  featuredProducts: [],
  solutionCategories: [],
  featuredSolution: {
    id: "solution-fallback",
    label: { en: "Energy solutions" },
    description: { en: "Integrated energy systems" },
    href: "/projects",
    visible: true,
    order: 0,
  },
  cases: [],
  news: [],
  documents: [],
  services: [],
  version: 3,
};

function publishedArticle(index: number): NewsAdminDto {
  const id = String(index).padStart(24, "0");
  const timestamp = `2026-09-${String(index).padStart(2, "0")}T10:00:00.000Z`;
  return {
    id,
    slug: `article-${index}`,
    category: "company-news",
    authorName: "Maglive Newsroom",
    featured: false,
    tags: [],
    translations: {},
    status: "published",
    publishedGlobal: { slug: `article-${index}`, category: "company-news", authorName: "Maglive Newsroom", featured: false, tags: [], publishedAt: timestamp },
    publishedSnapshots: { en: { publishedAt: timestamp, data: { title: `Article ${index}`, excerpt: `Summary ${index}`, content: [{ id: `paragraph-${index}`, type: "paragraph", text: `Body ${index}` }], seo: { keywords: [] } } } },
    localeStates: { en: "published", zh: "incomplete", fr: "incomplete" },
    firstPublishedAt: timestamp,
    createdBy: "507f1f77bcf86cd799439011",
    updatedBy: "507f1f77bcf86cd799439011",
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(languageApi.getLanguages).mockResolvedValue({ languages: [...languages] });
  vi.mocked(navigationApi.getNavigation).mockResolvedValue(navigation);
  vi.mocked(navigationApi.updateNavigation).mockImplementation(async (input) => {
    const parsed = updateNavigationRequestSchema.parse(input);
    return { ...parsed, version: parsed.version + 1 };
  });
  vi.mocked(newsApi.listNews).mockResolvedValue({
    items: [],
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  });
});

describe("navigation manager", () => {
  it("renders and saves fields for every language enabled in settings", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <NavigationManager />
      </LanguageProvider>,
    );

    const frenchLabel = await screen.findByLabelText("Label — French");
    expect(screen.getByLabelText("Label — English")).toHaveValue("Products");
    expect(screen.getByLabelText("Label — Simplified Chinese")).toHaveValue("产品");
    expect(frenchLabel).toHaveValue("");

    await user.type(frenchLabel, "Produits");
    await user.click(screen.getByRole("button", { name: "Save navigation" }));

    await waitFor(() => {
      expect(navigationApi.updateNavigation).toHaveBeenCalledWith(
        expect.objectContaining({
          primaryItems: [
            expect.objectContaining({
              label: {
                en: "Products",
                zh: "产品",
                fr: "Produits",
              },
            }),
          ],
        }),
      );
    });
  });

  it("removes a cleared translation so the configured fallback can be used", async () => {
    const user = userEvent.setup();
    vi.mocked(navigationApi.getNavigation).mockResolvedValue({
      ...navigation,
      primaryItems: [
        {
          ...navigation.primaryItems[0]!,
          label: { ...navigation.primaryItems[0]!.label, fr: "Produits" },
        },
      ],
    });
    render(
      <LanguageProvider>
        <NavigationManager />
      </LanguageProvider>,
    );

    const frenchLabel = await screen.findByLabelText("Label — French");
    await user.clear(frenchLabel);
    await user.click(screen.getByRole("button", { name: "Save navigation" }));

    await waitFor(() => {
      const saved = vi.mocked(navigationApi.updateNavigation).mock.calls[0]?.[0];
      expect(saved?.primaryItems[0]?.label).not.toHaveProperty("fr");
    });
  });

  it("adds a direct top-level navbar item", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <NavigationManager />
      </LanguageProvider>,
    );

    await screen.findByRole("heading", { name: "Navbar items" });
    await user.click(screen.getByRole("button", { name: "+ Add navbar item" }));
    const englishLabels = screen.getAllByLabelText("Label — English");
    const frenchLabels = screen.getAllByLabelText("Label — French");
    await user.clear(englishLabels[1]!);
    await user.type(englishLabels[1]!, "Careers");
    await user.type(frenchLabels[1]!, "Carrières");
    const links = screen.getAllByLabelText("Link");
    await user.clear(links[1]!);
    await user.type(links[1]!, "/careers");
    await user.click(screen.getByRole("button", { name: "Save navigation" }));

    await waitFor(() => {
      const saved = vi.mocked(navigationApi.updateNavigation).mock.calls[0]?.[0];
      expect(saved?.primaryItems).toHaveLength(2);
      expect(saved?.primaryItems[1]).toMatchObject({
        label: { en: "Careers", zh: "新菜单项", fr: "Carrières" },
        href: "/careers",
      });
    });
  });

  it("adds and removes a valid hover product inside a product category", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <NavigationManager />
      </LanguageProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /Products/ }));
    await user.click(screen.getAllByRole("button", { name: "+ Add product" })[0]!);
    expect(screen.getByDisplayValue("New product")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save navigation" }));

    await waitFor(() => {
      const saved = vi.mocked(navigationApi.updateNavigation).mock.calls[0]?.[0];
      expect(saved?.productCategories[0]?.products).toHaveLength(1);
      expect(() => updateNavigationRequestSchema.parse(saved)).not.toThrow();
    });

    await user.click(screen.getAllByRole("button", { name: "Remove" })[1]!);
    expect(screen.queryByDisplayValue("New product")).not.toBeInTheDocument();
  });

  it("creates schema-valid records from every navigation add action", async () => {
    const user = userEvent.setup();
    render(
      <LanguageProvider>
        <NavigationManager />
      </LanguageProvider>,
    );

    await screen.findByRole("heading", { name: "Navbar items" });
    await user.click(screen.getByRole("button", { name: "+ Add navbar item" }));

    await user.click(screen.getByRole("button", { name: /Products/ }));
    await user.click(screen.getByRole("button", { name: "+ Add category" }));

    await user.click(screen.getByRole("button", { name: /Solutions/ }));
    await user.click(screen.getByRole("button", { name: "+ Add solution" }));
    await user.click(screen.getByRole("button", { name: "+ Add feature" }));

    await user.click(screen.getByRole("button", { name: /Cases/ }));
    await user.click(screen.getByRole("button", { name: "+ Add case" }));
    await user.click(screen.getByRole("button", { name: /News/ }));
    expect(screen.getByRole("heading", { name: "Choose the stories visitors see" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Documents/ }));
    await user.click(screen.getByRole("button", { name: "+ Add document" }));
    await user.click(screen.getByRole("button", { name: /Services/ }));
    await user.click(screen.getByRole("button", { name: "+ Add service" }));
    await user.click(screen.getByRole("button", { name: "Save navigation" }));

    await waitFor(() => {
      const saved = vi.mocked(navigationApi.updateNavigation).mock.calls[0]?.[0];
      expect(() => updateNavigationRequestSchema.parse(saved)).not.toThrow();
      expect(saved).toMatchObject({
        primaryItems: expect.arrayContaining([expect.objectContaining({ label: expect.objectContaining({ en: "New menu item" }) })]),
        productCategories: expect.arrayContaining([expect.objectContaining({ label: expect.objectContaining({ en: "New category" }) })]),
        solutionCategories: expect.arrayContaining([expect.objectContaining({ feature: expect.objectContaining({ label: expect.objectContaining({ en: "New product" }) }) })]),
        cases: [expect.objectContaining({ label: expect.objectContaining({ en: "New product" }) })],
        news: [],
        documents: [expect.objectContaining({ label: expect.objectContaining({ en: "New link" }) })],
        services: [expect.objectContaining({ label: expect.objectContaining({ en: "New link" }) })],
      });
    });
  });

  it("selects and orders three published news records without duplicating their content", async () => {
    const user = userEvent.setup();
    const articles = [publishedArticle(1), publishedArticle(2), publishedArticle(3)];
    vi.mocked(newsApi.listNews).mockResolvedValue({
      items: articles,
      pagination: { page: 1, limit: 100, total: 3, totalPages: 1 },
    });
    render(
      <LanguageProvider>
        <NavigationManager />
      </LanguageProvider>,
    );

    await user.click(await screen.findByRole("button", { name: /News/ }));
    await user.click(screen.getByRole("button", { name: "3" }));
    for (const article of articles) {
      await user.click(await screen.findByRole("button", { name: new RegExp(article.publishedSnapshots.en!.data.title) }));
    }
    await user.click(screen.getByRole("button", { name: "Save navigation" }));

    await waitFor(() => {
      expect(navigationApi.updateNavigation).toHaveBeenCalledWith(expect.objectContaining({
        news: [],
        newsArticleIds: articles.map((article) => article.id),
        newsItemCount: 3,
      }));
    });
  });
});
