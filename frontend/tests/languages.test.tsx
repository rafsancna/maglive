import { createLanguageRequestSchema, type LanguageDto } from "@maglive/contracts";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageManager } from "@/admin/languages/LanguageManager";
import { LanguageProvider } from "@/admin/languages/LanguageProvider";
import * as languageApi from "@/admin/languages/api";
import { LANGUAGE_PRESETS } from "@/admin/languages/presets";

vi.mock("@/admin/languages/api", () => ({
  addLanguage: vi.fn(),
  getLanguages: vi.fn(),
}));

const english: LanguageDto = {
  code: "en",
  languageTag: "en",
  acceptLanguageAliases: [],
  direction: "ltr",
  fallback: "en",
  label: "English",
  nativeLabel: "English",
  builtIn: true,
};

const chinese: LanguageDto = {
  code: "zh",
  languageTag: "zh-Hans",
  acceptLanguageAliases: ["zh-CN", "zh-SG"],
  direction: "ltr",
  fallback: "en",
  label: "Simplified Chinese",
  nativeLabel: "简体中文",
  builtIn: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(languageApi.getLanguages).mockResolvedValue({ languages: [english, chinese] });
});

describe("language manager", () => {
  it("keeps every addable preset valid for the language API", () => {
    for (const preset of LANGUAGE_PRESETS.filter(({ request }) => request.code !== "en")) {
      expect(() => createLanguageRequestSchema.parse(preset.request)).not.toThrow();
    }
  });

  it("adds a language from a single predefined selection", async () => {
    const french: LanguageDto = {
      code: "fr",
      languageTag: "fr-FR",
      acceptLanguageAliases: ["fr-CA", "fr-BE", "fr-CH"],
      direction: "ltr",
      fallback: "en",
      label: "French",
      nativeLabel: "Français",
      builtIn: false,
    };
    vi.mocked(languageApi.addLanguage).mockResolvedValue(french);
    const user = userEvent.setup();

    render(
      <LanguageProvider>
        <LanguageManager />
      </LanguageProvider>,
    );

    const selector = await screen.findByLabelText("Language");
    expect(screen.queryByLabelText("Route code")).not.toBeInTheDocument();
    await user.selectOptions(selector, "fr");

    expect(screen.getByText("Route /fr · fr-FR · LTR")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add French" }));

    await waitFor(() => {
      expect(languageApi.addLanguage).toHaveBeenCalledWith({
        code: "fr",
        languageTag: "fr-FR",
        acceptLanguageAliases: ["fr-CA", "fr-BE", "fr-CH"],
        direction: "ltr",
        fallback: "en",
        label: "French",
        nativeLabel: "Français",
      });
    });
  });

  it("marks enabled language presets as unavailable", async () => {
    render(
      <LanguageProvider>
        <LanguageManager />
      </LanguageProvider>,
    );

    const selector = await screen.findByLabelText("Language");
    expect(selector.querySelector('option[value="en"]')).toBeDisabled();
    expect(selector.querySelector('option[value="zh"]')).toBeDisabled();
    expect(selector.querySelector('option[value="fr"]')).toBeEnabled();
  });
});
