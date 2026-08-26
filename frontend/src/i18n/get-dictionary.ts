import "server-only";

import type { LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "./dictionary";

// Keep imports static so Next can bundle dictionaries deterministically. The Record
// makes adding a registry locale a compile error until its dictionary loader exists.
const loaders = {
  en: async () => (await import("./dictionaries/en.json")).default,
  zh: async () => (await import("./dictionaries/zh.json")).default
} satisfies Record<LocaleCode, () => Promise<Dictionary>>;

export async function getDictionary(locale: LocaleCode): Promise<Dictionary> {
  return loaders[locale]();
}
