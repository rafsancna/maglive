import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  getLocaleMetadata,
  isLocaleCode,
  type LanguageDto,
  type LocaleCode
} from "@maglive/contracts";

const STATIC_FILE_PATTERN = /\.[^/]+$/;
const LOCALE_LIKE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]{2,8}){0,2}$/i;

export const LOCALE_COOKIE_NAME = "maglive_locale";
export const LOCALE_REQUEST_HEADER = "x-maglive-locale";

export function isExcludedFromLocaleRouting(pathname: string): boolean {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api/internal" ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/uploads" ||
    pathname.startsWith("/uploads/") ||
    pathname === "/favicon.ico" ||
    STATIC_FILE_PATTERN.test(pathname)
  );
}

export function getPathLocale(pathname: string): string | undefined {
  return pathname.split("/").filter(Boolean)[0];
}

export function looksLikeUnsupportedLocale(pathname: string): boolean {
  const segment = getPathLocale(pathname);
  return segment !== undefined && LOCALE_LIKE_PATTERN.test(segment) && !isLocaleCode(segment);
}

const builtInLanguages: readonly LanguageDto[] = LOCALE_CODES.map((code) => {
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

function findLocaleForLanguageTag(
  languageTag: string,
  languages: readonly LanguageDto[],
): LocaleCode | undefined {
  const normalizedTag = languageTag.toLowerCase();
  const exactMatch = languages.find((metadata) => {
    return [metadata.code, metadata.languageTag, ...metadata.acceptLanguageAliases].some(
      (candidate) => candidate.toLowerCase() === normalizedTag
    );
  });

  if (exactMatch !== undefined) {
    return exactMatch.code;
  }

  const [baseLanguage] = normalizedTag.split("-");
  const baseMatches = languages.filter((metadata) => {
    const [candidateBase] = metadata.languageTag.toLowerCase().split("-");
    return candidateBase === baseLanguage;
  });

  // A base-language fallback is safe only while it identifies one enabled locale.
  // Explicit aliases disambiguate regional/script variants once more are registered.
  return baseMatches.length === 1 ? baseMatches[0]?.code : undefined;
}

export function detectLocale(
  cookieLocale: string | undefined,
  acceptLanguage: string | null,
  languages: readonly LanguageDto[] = builtInLanguages,
): LocaleCode {
  if (
    cookieLocale !== undefined &&
    languages.some(({ code }) => code === cookieLocale)
  ) {
    return cookieLocale;
  }

  if (acceptLanguage !== null) {
    const preferences = acceptLanguage
      .split(",")
      .map((entry, index) => {
        const [rawTag = "", ...parameters] = entry.trim().split(";");
        const qualityParameter = parameters.find((parameter) =>
          parameter.trim().startsWith("q=")
        );
        const quality = qualityParameter
          ? Number.parseFloat(qualityParameter.trim().slice(2))
          : 1;
        return {
          tag: rawTag.toLowerCase(),
          quality: Number.isFinite(quality) ? quality : 0,
          index
        };
      })
      .sort((left, right) => right.quality - left.quality || left.index - right.index);

    for (const preference of preferences) {
      const locale = findLocaleForLanguageTag(preference.tag, languages);
      if (locale !== undefined) {
        return locale;
      }
    }
  }

  return DEFAULT_LOCALE;
}

export function localizePath(locale: LocaleCode, href: string): string {
  if (!href.startsWith("/")) {
    throw new Error("Locale-aware links require a root-relative path.");
  }

  const normalized = href === "/" ? "" : href.replace(/\/$/, "");
  return `/${locale}${normalized}`;
}

export function switchPathLocale(pathname: string, locale: LocaleCode): string {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] !== undefined && isLocaleCode(segments[0])) {
    segments[0] = locale;
    return `/${segments.join("/")}`;
  }
  return `/${locale}`;
}
