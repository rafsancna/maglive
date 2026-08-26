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
});
