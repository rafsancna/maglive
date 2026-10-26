import type { Dictionary } from "@/i18n/dictionary";
import type { LanguageDto } from "@maglive/contracts";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/site/Navbar";
import { megaMenuMockData } from "@/data/navigation/megaMenuMockData";
import englishDictionary from "@/i18n/dictionaries/en.json";

const navigation = vi.hoisted(() => ({ pathname: "/fr" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
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
    code: "fr",
    languageTag: "fr-FR",
    acceptLanguageAliases: [],
    direction: "ltr",
    fallback: "en",
    label: "French",
    nativeLabel: "Français",
    builtIn: false,
  },
];

describe("managed public navbar items", () => {
  beforeEach(() => {
    navigation.pathname = "/fr";
  });

  it("renders a saved custom item using its active-locale translation", () => {
    render(
      <Navbar
        dictionary={englishDictionary as Dictionary}
        languages={languages}
        locale="fr"
        navigationData={{
          ...megaMenuMockData,
          primaryItems: [
            {
              id: "careers",
              label: { en: "Careers", fr: "Carrières" },
              href: "/careers",
              visible: true,
              order: 0,
            },
          ],
        }}
      />,
    );

    const links = screen.getAllByRole("link", { name: /Carrières/ });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/fr/careers");
  });

  it("closes an open mega menu immediately when one of its links is clicked", async () => {
    render(
      <Navbar
        dictionary={englishDictionary as Dictionary}
        languages={languages}
        locale="en"
        navigationData={megaMenuMockData}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("link", { name: /^Products/ }));
    const menu = await screen.findByRole("region", { name: "Products" });
    fireEvent.click(menu.getElementsByTagName("a")[0]!);

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Products" })).not.toBeInTheDocument();
    });
  });

  it("replaces an open mega menu with the language dropdown on hover", async () => {
    render(
      <Navbar
        dictionary={englishDictionary as Dictionary}
        languages={languages}
        locale="en"
        navigationData={megaMenuMockData}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("link", { name: /^Products/ }));
    expect(await screen.findByRole("region", { name: "Products" })).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole("button", { name: /Choose language: English/ }));

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Products" })).not.toBeInTheDocument();
    });
    expect(screen.getByLabelText("Choose language")).toBeInTheDocument();
  });

  it("closes an open mega menu when the pathname changes", async () => {
    const view = render(
      <Navbar
        dictionary={englishDictionary as Dictionary}
        languages={languages}
        locale="en"
        navigationData={megaMenuMockData}
      />,
    );

    fireEvent.mouseEnter(screen.getByRole("link", { name: /^Products/ }));
    expect(await screen.findByRole("region", { name: "Products" })).toBeInTheDocument();

    navigation.pathname = "/en/products";
    view.rerender(
      <Navbar
        dictionary={englishDictionary as Dictionary}
        languages={languages}
        locale="en"
        navigationData={megaMenuMockData}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByRole("region", { name: "Products" })).not.toBeInTheDocument();
    });
  });
});
