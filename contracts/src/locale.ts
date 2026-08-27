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

export type LocaleCode = string;
export type BuiltInLocaleCode = keyof typeof localeDefinitions;

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

const checkedLocaleDefinitions = localeDefinitions satisfies {
  readonly [Code in keyof typeof localeDefinitions]: LocaleMetadata & {
    readonly routeCode: Code;
  };
};

export const LOCALE_REGISTRY = checkedLocaleDefinitions;

const localeCodeValues = Object.keys(LOCALE_REGISTRY) as BuiltInLocaleCode[];

export const LOCALE_CODES: readonly BuiltInLocaleCode[] = Object.freeze(localeCodeValues);
export const localeCodeSchema = z
  .string()
  .min(2)
  .max(24)
  .regex(/^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/, "Expected a lowercase locale route code");

export function isLocaleCode(value: string): value is LocaleCode {
  return localeCodeSchema.safeParse(value).success;
}

export function getLocaleMetadata(locale: LocaleCode): LocaleMetadata {
  return checkedLocaleDefinitions[locale as BuiltInLocaleCode] ?? checkedLocaleDefinitions.en;
}
