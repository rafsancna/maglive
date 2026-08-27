import "server-only";

import {
  LOCALE_CODES,
  getLocaleMetadata,
  type LanguageDto,
} from "@maglive/contracts";
import { getPublicLanguages } from "@/lib/public-api";

export const builtInLanguages: readonly LanguageDto[] = LOCALE_CODES.map((code) => {
  const metadata = getLocaleMetadata(code);
  return {
    code,
    languageTag: metadata.languageTag,
    acceptLanguageAliases: [...metadata.acceptLanguageAliases],
    direction: metadata.direction,
    fallback: metadata.fallback,
    label: metadata.label,
    nativeLabel: metadata.nativeLabel,
    builtIn: true,
  };
});

export async function getAvailableLanguages(): Promise<readonly LanguageDto[]> {
  try {
    return (await getPublicLanguages()).languages;
  } catch {
    return builtInLanguages;
  }
}

export async function getAvailableLanguage(code: string): Promise<LanguageDto | undefined> {
  return (await getAvailableLanguages()).find((language) => language.code === code);
}
