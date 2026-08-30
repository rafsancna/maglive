import type { Dictionary } from "@/i18n/dictionary";
import type { LanguageDto } from "@maglive/contracts";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Navbar } from "@/components/site/Navbar";
import { megaMenuMockData } from "@/data/navigation/megaMenuMockData";
import englishDictionary from "@/i18n/dictionaries/en.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/fr",
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
});
