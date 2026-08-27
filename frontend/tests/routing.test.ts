import { describe, expect, it } from "vitest";
import {
  detectLocale,
  isExcludedFromLocaleRouting,
  localizePath,
  looksLikeUnsupportedLocale,
  switchPathLocale
} from "@/i18n/routing";

describe("locale routing", () => {
  it("uses cookie, weighted language header, then English", () => {
    expect(detectLocale("zh", "en-US,en;q=0.9")).toBe("zh");
    expect(detectLocale(undefined, "fr;q=1, zh-CN;q=0.9, en;q=0.5")).toBe("zh");
    expect(detectLocale(undefined, "zh-Hans-SG;q=0.9, en;q=0.5")).toBe("zh");
    expect(detectLocale(undefined, "de-DE")).toBe("en");
    expect(
      detectLocale(undefined, "fr-CA, en;q=0.8", [
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
          acceptLanguageAliases: ["fr-CA"],
          direction: "ltr",
          fallback: "en",
          label: "French",
          nativeLabel: "Français",
          builtIn: false,
        },
      ]),
    ).toBe("fr");
  });

  it("preserves localized paths and rejects accidental external hrefs", () => {
    expect(localizePath("en", "/about")).toBe("/en/about");
    expect(localizePath("zh", "/")).toBe("/zh");
    expect(switchPathLocale("/en/downloads", "zh")).toBe("/zh/downloads");
    expect(() => localizePath("en", "https://example.com")).toThrow();
  });

  it("does not intercept internal, administrative, asset, or invalid-locale paths", () => {
    expect(isExcludedFromLocaleRouting("/admin/products")).toBe(true);
    expect(isExcludedFromLocaleRouting("/api/internal/preview")).toBe(true);
    expect(isExcludedFromLocaleRouting("/_next/static/app.js")).toBe(true);
    expect(isExcludedFromLocaleRouting("/manual.pdf")).toBe(true);
    // Syntactically valid locale routes are validated against the managed
    // registry by the server-rendered locale layout.
    expect(looksLikeUnsupportedLocale("/xx")).toBe(false);
    expect(looksLikeUnsupportedLocale("/pt-BR")).toBe(true);
    expect(looksLikeUnsupportedLocale("/about")).toBe(false);
  });
});
