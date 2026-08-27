import { render, screen } from "@testing-library/react";
import { LOCALE_CODES, LOCALE_REGISTRY } from "@maglive/contracts";
import { describe, expect, it, vi } from "vitest";
import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/about"
}));

describe("LocaleSwitcher", () => {
  it("renders every locale registered by the contracts package", () => {
    render(<LocaleSwitcher currentLocale="en" label="Choose language" />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(LOCALE_CODES.length);

    for (const locale of LOCALE_CODES) {
      const metadata = LOCALE_REGISTRY[locale];
      const link = screen.getByRole("link", { name: metadata.nativeLabel });
      expect(link).toHaveAttribute("href", `/${locale}/about`);
      expect(link).toHaveAttribute("lang", metadata.languageTag);
    }
  });

  it("renders languages supplied by the managed registry", () => {
    render(
      <LocaleSwitcher
        currentLocale="en"
        label="Choose language"
        languages={[
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
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute(
      "href",
      "/fr/about",
    );
  });
});
