import {
  FLAG_COUNTRY_CODES,
  LANGUAGE_COUNTRY_CODES,
  LOCALE_CODES,
  countryCodeForLanguage,
  flagAssetPath,
  flagPublicPath,
  getLocaleMetadata,
} from "@maglive/contracts";
import { readdir } from "node:fs/promises";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { createTestConfig } from "./helpers/config.js";

const flagDirectory = new URL("../assets/flags/", import.meta.url);

async function storedCountryCodes(): Promise<string[]> {
  const entries = await readdir(flagDirectory);
  return entries
    .filter((entry) => entry.endsWith(".svg"))
    .map((entry) => entry.replace(/\.svg$/, ""))
    .sort();
}

describe("country flags", () => {
  it("stores one SVG per advertised country", async () => {
    const stored = await storedCountryCodes();
    expect(stored).toEqual([...FLAG_COUNTRY_CODES].sort());
  });

  it("has a flag for every built-in language and language preset", async () => {
    const stored = new Set(await storedCountryCodes());
    for (const code of LOCALE_CODES) {
      const metadata = getLocaleMetadata(code);
      const countryCode = countryCodeForLanguage(code, metadata.languageTag);
      expect(countryCode, `${code} has no country flag`).toBeDefined();
      expect(stored.has(countryCode!.toLowerCase())).toBe(true);
    }
    // Every country referenced by the language map must ship with the backend.
    for (const countryCode of Object.values(LANGUAGE_COUNTRY_CODES)) {
      expect(stored.has(countryCode.toLowerCase())).toBe(true);
    }
  });

  it("derives country codes from the language tag before the defaults", () => {
    expect(countryCodeForLanguage("pt-br", "pt-BR")).toBe("BR");
    expect(countryCodeForLanguage("en", "en-GB")).toBe("GB");
    expect(countryCodeForLanguage("en", "en")).toBe("US");
    expect(countryCodeForLanguage("zh", "zh-Hans")).toBe("CN");
    expect(countryCodeForLanguage("xx", "xx")).toBeUndefined();
  });

  it("keeps asset and public paths in sync", () => {
    expect(flagAssetPath("US")).toBe("/media/flags/us.svg");
    expect(flagPublicPath("US")).toBe("/flags/us.svg");
  });

  it("serves the stored flags with an immutable cache", async () => {
    const app = createApp({
      config: createTestConfig(),
      databaseHealth: () => ({ status: "ready" }),
    });

    const response = await request(app).get("/media/flags/us.svg").expect(200);
    expect(response.headers["content-type"]).toContain("image/svg+xml");
    expect(response.headers["cache-control"]).toContain("immutable");
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.body.toString("utf8")).toContain("<svg");

    await request(app).get("/media/flags/zz.svg").expect(404);
  });
});
