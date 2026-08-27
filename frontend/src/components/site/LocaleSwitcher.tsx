"use client";

import {
  LOCALE_CODES,
  getLocaleMetadata,
  type LanguageDto,
  type LocaleCode,
} from "@maglive/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE_NAME, switchPathLocale } from "@/i18n/routing";

type LocaleSwitcherProps = {
  currentLocale: LocaleCode;
  label: string;
  languages?: readonly LanguageDto[];
};

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

export function LocaleSwitcher({ currentLocale, label, languages = builtInLanguages }: LocaleSwitcherProps) {
  const pathname = usePathname();

  function rememberLocale(locale: LocaleCode) {
    // The locale preference is deliberately non-sensitive and must survive navigation.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  return (
    <div aria-label={label} className="locale-switcher" role="group">
      {languages.map((metadata) => {
        const locale = metadata.code;
        return (
          <Link
            aria-current={locale === currentLocale ? "page" : undefined}
            className="locale-switcher__link"
            href={switchPathLocale(pathname, locale)}
            key={locale}
            lang={metadata.languageTag}
            onClick={() => rememberLocale(locale)}
          >
            {metadata.nativeLabel}
          </Link>
        );
      })}
    </div>
  );
}
