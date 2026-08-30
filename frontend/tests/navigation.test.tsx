import type { LanguageDto, NavigationAdminDto } from "@maglive/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/admin/languages/LanguageProvider";
import { NavigationManager } from "@/admin/navigation/NavigationManager";
import * as languageApi from "@/admin/languages/api";
import * as navigationApi from "@/admin/navigation/api";

vi.mock("@/admin/languages/api", () => ({
  getLanguages: vi.fn(),
}));

vi.mock("@/admin/navigation/api", () => ({
  getNavigation: vi.fn(),
  updateNavigation: vi.fn(),
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(languageApi.getLanguages).mockResolvedValue({ languages: [...languages] });
  vi.mocked(navigationApi.getNavigation).mockResolvedValue(navigation);
  vi.mocked(navigationApi.updateNavigation).mockImplementation(async (input) => ({
    ...input,
    version: input.version + 1,
  }));
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
});
