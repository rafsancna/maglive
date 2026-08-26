"use client";

import { LOCALE_CODES, LOCALE_REGISTRY, type LocaleCode } from "@maglive/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LOCALE_COOKIE_NAME, switchPathLocale } from "@/i18n/routing";

type LocaleSwitcherProps = {
  currentLocale: LocaleCode;
  label: string;
};

export function LocaleSwitcher({ currentLocale, label }: LocaleSwitcherProps) {
  const pathname = usePathname();

  function rememberLocale(locale: LocaleCode) {
    // The locale preference is deliberately non-sensitive and must survive navigation.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  return (
    <div aria-label={label} className="locale-switcher" role="group">
      {LOCALE_CODES.map((locale) => {
        const metadata = LOCALE_REGISTRY[locale];
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
