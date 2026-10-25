import {
  countryCodeForLanguage,
  type CreateLanguageRequest,
} from "@maglive/contracts";

export type LanguagePreset = Readonly<{
  /** Country whose flag represents the language, when one is stored. */
  countryCode?: string;
  request: CreateLanguageRequest;
}>;

function preset(request: CreateLanguageRequest): LanguagePreset {
  const countryCode = countryCodeForLanguage(request.code, request.languageTag);
  return countryCode === undefined ? { request } : { countryCode, request };
}

export const LANGUAGE_PRESETS: readonly LanguagePreset[] = [
  preset({ code: "ar", languageTag: "ar-SA", acceptLanguageAliases: ["ar-AE", "ar-EG", "ar-MA"], direction: "rtl", fallback: "en", label: "Arabic", nativeLabel: "العربية" }),
  preset({ code: "bn", languageTag: "bn-BD", acceptLanguageAliases: ["bn-IN"], direction: "ltr", fallback: "en", label: "Bengali", nativeLabel: "বাংলা" }),
  preset({ code: "zh", languageTag: "zh-Hans", acceptLanguageAliases: ["zh-CN", "zh-SG"], direction: "ltr", fallback: "en", label: "Simplified Chinese", nativeLabel: "简体中文" }),
  preset({ code: "nl", languageTag: "nl-NL", acceptLanguageAliases: ["nl-BE"], direction: "ltr", fallback: "en", label: "Dutch", nativeLabel: "Nederlands" }),
  preset({ code: "en", languageTag: "en", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "English", nativeLabel: "English" }),
  preset({ code: "fr", languageTag: "fr-FR", acceptLanguageAliases: ["fr-CA", "fr-BE", "fr-CH"], direction: "ltr", fallback: "en", label: "French", nativeLabel: "Français" }),
  preset({ code: "de", languageTag: "de-DE", acceptLanguageAliases: ["de-AT", "de-CH"], direction: "ltr", fallback: "en", label: "German", nativeLabel: "Deutsch" }),
  preset({ code: "he", languageTag: "he-IL", acceptLanguageAliases: [], direction: "rtl", fallback: "en", label: "Hebrew", nativeLabel: "עברית" }),
  preset({ code: "hi", languageTag: "hi-IN", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Hindi", nativeLabel: "हिन्दी" }),
  preset({ code: "id", languageTag: "id-ID", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Indonesian", nativeLabel: "Bahasa Indonesia" }),
  preset({ code: "it", languageTag: "it-IT", acceptLanguageAliases: ["it-CH"], direction: "ltr", fallback: "en", label: "Italian", nativeLabel: "Italiano" }),
  preset({ code: "ja", languageTag: "ja-JP", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Japanese", nativeLabel: "日本語" }),
  preset({ code: "ko", languageTag: "ko-KR", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Korean", nativeLabel: "한국어" }),
  preset({ code: "ms", languageTag: "ms-MY", acceptLanguageAliases: ["ms-BN"], direction: "ltr", fallback: "en", label: "Malay", nativeLabel: "Bahasa Melayu" }),
  preset({ code: "fa", languageTag: "fa-IR", acceptLanguageAliases: ["fa-AF"], direction: "rtl", fallback: "en", label: "Persian", nativeLabel: "فارسی" }),
  preset({ code: "pl", languageTag: "pl-PL", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Polish", nativeLabel: "Polski" }),
  preset({ code: "pt-br", languageTag: "pt-BR", acceptLanguageAliases: ["pt"], direction: "ltr", fallback: "en", label: "Portuguese (Brazil)", nativeLabel: "Português (Brasil)" }),
  preset({ code: "ru", languageTag: "ru-RU", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Russian", nativeLabel: "Русский" }),
  preset({ code: "es", languageTag: "es-ES", acceptLanguageAliases: ["es-MX", "es-AR", "es-CO"], direction: "ltr", fallback: "en", label: "Spanish", nativeLabel: "Español" }),
  preset({ code: "th", languageTag: "th-TH", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Thai", nativeLabel: "ไทย" }),
  preset({ code: "tr", languageTag: "tr-TR", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Turkish", nativeLabel: "Türkçe" }),
  preset({ code: "uk", languageTag: "uk-UA", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Ukrainian", nativeLabel: "Українська" }),
  preset({ code: "vi", languageTag: "vi-VN", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Vietnamese", nativeLabel: "Tiếng Việt" }),
] as const;

export function getLanguagePreset(code: string): LanguagePreset | undefined {
  return LANGUAGE_PRESETS.find((preset) => preset.request.code === code);
}
