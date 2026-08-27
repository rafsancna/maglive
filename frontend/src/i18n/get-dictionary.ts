import "server-only";

import type { LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "./dictionary";
import { getAvailableLanguages } from "./languages";

// Keep imports static so Next can bundle dictionaries deterministically. The Record
// makes adding a registry locale a compile error until its dictionary loader exists.
const loaders: Partial<Record<LocaleCode, () => Promise<Dictionary>>> = {
  en: async () => (await import("./dictionaries/en.json")).default,
  zh: async () => (await import("./dictionaries/zh.json")).default
};

export async function getDictionary(locale: LocaleCode): Promise<Dictionary> {
  const direct = loaders[locale];
  if (direct !== undefined) return direct();
  const languages = await getAvailableLanguages();
  const visited = new Set<string>();
  let candidate = locale;
  while (!visited.has(candidate)) {
    visited.add(candidate);
    const loader = loaders[candidate];
    if (loader !== undefined) return loader();
    candidate = languages.find((language) => language.code === candidate)?.fallback ?? "en";
  }
  return loaders.en!();
}
