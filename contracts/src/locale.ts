import { z } from "zod";

const localeDefinitions = {
  en: {
    routeCode: "en",
    languageTag: "en",
    acceptLanguageAliases: [],
    direction: "ltr",
    fallback: "en",
    label: "English",
    nativeLabel: "English"
  },
  zh: {
    routeCode: "zh",
    languageTag: "zh-Hans",
    acceptLanguageAliases: ["zh-CN", "zh-SG"],
    direction: "ltr",
    fallback: "en",
    label: "Simplified Chinese",
    nativeLabel: "简体中文"
  }
} as const;

export type LocaleCode = keyof typeof localeDefinitions;

export const DEFAULT_LOCALE: LocaleCode = "en";

export type LocaleMetadata = Readonly<{
  routeCode: LocaleCode;
  languageTag: string;
  acceptLanguageAliases: readonly string[];
  direction: "ltr" | "rtl";
  fallback: LocaleCode;
  label: string;
  nativeLabel: string;
}>;

export const LOCALE_REGISTRY = localeDefinitions satisfies {
  readonly [Code in LocaleCode]: LocaleMetadata & { readonly routeCode: Code };
};

const localeCodeValues = Object.keys(LOCALE_REGISTRY) as [LocaleCode, ...LocaleCode[]];

export const LOCALE_CODES: readonly LocaleCode[] = Object.freeze(localeCodeValues);
export const localeCodeSchema = z.enum(localeCodeValues);

export function isLocaleCode(value: string): value is LocaleCode {
  return localeCodeSchema.safeParse(value).success;
}

export function getLocaleMetadata(locale: LocaleCode): LocaleMetadata {
  return LOCALE_REGISTRY[locale];
}
