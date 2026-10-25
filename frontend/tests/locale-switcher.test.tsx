import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LOCALE_CODES, LOCALE_REGISTRY } from "@maglive/contracts";
import { describe, expect, it, vi } from "vitest";
import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/about"
}));

describe("LocaleSwitcher", () => {
  it("renders every locale registered by the contracts package in a dropdown", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher currentLocale="en" label="Choose language" />);

    const trigger = screen.getByRole("button", { name: "Choose language: English" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(LOCALE_CODES.length);

    for (const locale of LOCALE_CODES) {
      const metadata = LOCALE_REGISTRY[locale];
      const link = screen.getByRole("link", { name: metadata.nativeLabel });
      expect(link).toHaveAttribute("href", `/${locale}/about`);
      expect(link).toHaveAttribute("lang", metadata.languageTag);
    }
  });

  it("stays open while the pointer crosses the gap into the dropdown panel", () => {
    vi.useFakeTimers();
    render(<LocaleSwitcher currentLocale="en" label="Choose language" />);

    const trigger = screen.getByRole("button", { name: "Choose language: English" });
    fireEvent.mouseEnter(trigger);
    const panel = screen.getByLabelText("Choose language");
    const root = trigger.closest(".locale-menu");
    expect(root).not.toBeNull();

    fireEvent.mouseLeave(root!);
    expect(panel).toBeInTheDocument();
    fireEvent.mouseEnter(panel);
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByLabelText("Choose language")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("renders languages supplied by the managed registry", async () => {
    const user = userEvent.setup();
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
            countryCode: "US",
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
            countryCode: "FR",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose language: English" }));
    expect(screen.getByRole("link", { name: "Français" })).toHaveAttribute(
      "href",
      "/fr/about",
    );
    expect(screen.getByRole("link", { name: "Français" }).querySelector("img")).toHaveAttribute(
      "src",
      "/flags/fr.svg",
    );
  });

  it("uses stored flag images instead of emoji", async () => {
    const user = userEvent.setup();
    render(<LocaleSwitcher currentLocale="en" label="Choose language" />);

    const trigger = screen.getByRole("button", { name: "Choose language: English" });
    expect(trigger.querySelector("img")).toHaveAttribute("src", "/flags/us.svg");

    await user.click(trigger);
    for (const locale of LOCALE_CODES) {
      const metadata = LOCALE_REGISTRY[locale];
      const link = screen.getByRole("link", { name: metadata.nativeLabel });
      expect(link.querySelector("img")).not.toBeNull();
    }
    expect(screen.getByRole("link", { name: "简体中文" }).querySelector("img")).toHaveAttribute(
      "src",
      "/flags/cn.svg",
    );
  });

  it("falls back to a country code badge when no flag is stored", async () => {
    const user = userEvent.setup();
    render(
      <LocaleSwitcher
        currentLocale="en"
        label="Choose language"
        languages={[
          {
            code: "xx",
            languageTag: "xx",
            acceptLanguageAliases: [],
            direction: "ltr",
            fallback: "en",
            label: "Example",
            nativeLabel: "Example",
            builtIn: false,
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Choose language: Example" }));
    const link = screen.getByRole("link", { name: "Example" });
    expect(link.querySelector("img")).toBeNull();
    expect(link.textContent).toContain("XX");
  });
});
