import type { CreateLanguageRequest } from "@maglive/contracts";

export type LanguagePreset = Readonly<{
  flag: string;
  request: CreateLanguageRequest;
}>;

export const LANGUAGE_PRESETS: readonly LanguagePreset[] = [
  {
    flag: "🇸🇦",
    request: { code: "ar", languageTag: "ar-SA", acceptLanguageAliases: ["ar-AE", "ar-EG", "ar-MA"], direction: "rtl", fallback: "en", label: "Arabic", nativeLabel: "العربية" },
  },
  {
    flag: "🇧🇩",
    request: { code: "bn", languageTag: "bn-BD", acceptLanguageAliases: ["bn-IN"], direction: "ltr", fallback: "en", label: "Bengali", nativeLabel: "বাংলা" },
  },
  {
    flag: "🇨🇳",
    request: { code: "zh", languageTag: "zh-Hans", acceptLanguageAliases: ["zh-CN", "zh-SG"], direction: "ltr", fallback: "en", label: "Simplified Chinese", nativeLabel: "简体中文" },
  },
  {
    flag: "🇳🇱",
    request: { code: "nl", languageTag: "nl-NL", acceptLanguageAliases: ["nl-BE"], direction: "ltr", fallback: "en", label: "Dutch", nativeLabel: "Nederlands" },
  },
  {
    flag: "🇺🇸",
    request: { code: "en", languageTag: "en", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "English", nativeLabel: "English" },
  },
  {
    flag: "🇫🇷",
    request: { code: "fr", languageTag: "fr-FR", acceptLanguageAliases: ["fr-CA", "fr-BE", "fr-CH"], direction: "ltr", fallback: "en", label: "French", nativeLabel: "Français" },
  },
  {
    flag: "🇩🇪",
    request: { code: "de", languageTag: "de-DE", acceptLanguageAliases: ["de-AT", "de-CH"], direction: "ltr", fallback: "en", label: "German", nativeLabel: "Deutsch" },
  },
  {
    flag: "🇮🇱",
    request: { code: "he", languageTag: "he-IL", acceptLanguageAliases: [], direction: "rtl", fallback: "en", label: "Hebrew", nativeLabel: "עברית" },
  },
  {
    flag: "🇮🇳",
    request: { code: "hi", languageTag: "hi-IN", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Hindi", nativeLabel: "हिन्दी" },
  },
  {
    flag: "🇮🇩",
    request: { code: "id", languageTag: "id-ID", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
  },
  {
    flag: "🇮🇹",
    request: { code: "it", languageTag: "it-IT", acceptLanguageAliases: ["it-CH"], direction: "ltr", fallback: "en", label: "Italian", nativeLabel: "Italiano" },
  },
  {
    flag: "🇯🇵",
    request: { code: "ja", languageTag: "ja-JP", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Japanese", nativeLabel: "日本語" },
  },
  {
    flag: "🇰🇷",
    request: { code: "ko", languageTag: "ko-KR", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Korean", nativeLabel: "한국어" },
  },
  {
    flag: "🇲🇾",
    request: { code: "ms", languageTag: "ms-MY", acceptLanguageAliases: ["ms-BN"], direction: "ltr", fallback: "en", label: "Malay", nativeLabel: "Bahasa Melayu" },
  },
  {
    flag: "🇮🇷",
    request: { code: "fa", languageTag: "fa-IR", acceptLanguageAliases: ["fa-AF"], direction: "rtl", fallback: "en", label: "Persian", nativeLabel: "فارسی" },
  },
  {
    flag: "🇵🇱",
    request: { code: "pl", languageTag: "pl-PL", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Polish", nativeLabel: "Polski" },
  },
  {
    flag: "🇧🇷",
    request: { code: "pt-br", languageTag: "pt-BR", acceptLanguageAliases: ["pt"], direction: "ltr", fallback: "en", label: "Portuguese (Brazil)", nativeLabel: "Português (Brasil)" },
  },
  {
    flag: "🇷🇺",
    request: { code: "ru", languageTag: "ru-RU", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Russian", nativeLabel: "Русский" },
  },
  {
    flag: "🇪🇸",
    request: { code: "es", languageTag: "es-ES", acceptLanguageAliases: ["es-MX", "es-AR", "es-CO"], direction: "ltr", fallback: "en", label: "Spanish", nativeLabel: "Español" },
  },
  {
    flag: "🇹🇭",
    request: { code: "th", languageTag: "th-TH", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Thai", nativeLabel: "ไทย" },
  },
  {
    flag: "🇹🇷",
    request: { code: "tr", languageTag: "tr-TR", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Turkish", nativeLabel: "Türkçe" },
  },
  {
    flag: "🇺🇦",
    request: { code: "uk", languageTag: "uk-UA", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Ukrainian", nativeLabel: "Українська" },
  },
  {
    flag: "🇻🇳",
    request: { code: "vi", languageTag: "vi-VN", acceptLanguageAliases: [], direction: "ltr", fallback: "en", label: "Vietnamese", nativeLabel: "Tiếng Việt" },
  },
] as const;

export function getLanguagePreset(code: string): LanguagePreset | undefined {
  return LANGUAGE_PRESETS.find((preset) => preset.request.code === code);
}
