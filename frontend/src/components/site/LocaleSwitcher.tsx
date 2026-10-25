"use client";

import {
  LOCALE_CODES,
  countryCodeForLanguage,
  getLocaleMetadata,
  type LanguageDto,
  type LocaleCode,
} from "@maglive/contracts";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CountryFlag } from "@/components/media/CountryFlag";
import { LOCALE_COOKIE_NAME, switchPathLocale } from "@/i18n/routing";

type LocaleSwitcherProps = {
  currentLocale: LocaleCode;
  label: string;
  languages?: readonly LanguageDto[];
  onOpen?: () => void;
};

function flagMetadata(
  code: string,
  languageTag: string,
): Pick<LanguageDto, "countryCode"> {
  const countryCode = countryCodeForLanguage(code, languageTag);
  return countryCode === undefined ? {} : { countryCode };
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
    ...flagMetadata(code, metadata.languageTag),
  };
});

/**
 * Country flags are served as SVG files from our own origin, so they render
 * everywhere (unlike flag emoji, which Windows and many Linux setups show as
 * plain letters) and never depend on the host the site is deployed to.
 */
function LanguageFlag({ language, variant }: { language: LanguageDto; variant: "trigger" | "option" }) {
  return (
    <CountryFlag
      className={variant === "trigger" ? "locale-menu__flag" : "locale-menu__option-flag"}
      countryCode={language.countryCode}
      fallback={language.code.slice(0, 2).toUpperCase()}
    />
  );
}

export function LocaleSwitcher({ currentLocale, label, languages = builtInLanguages, onOpen }: LocaleSwitcherProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const hoverCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeLanguage = languages.find(({ code }) => code === currentLocale) ?? languages[0] ?? builtInLanguages[0]!;

  function cancelHoverClose() {
    if (hoverCloseTimer.current === null) return;
    clearTimeout(hoverCloseTimer.current);
    hoverCloseTimer.current = null;
  }

  function scheduleHoverClose() {
    cancelHoverClose();
    hoverCloseTimer.current = setTimeout(() => {
      setIsOpen(false);
      hoverCloseTimer.current = null;
    }, 260);
  }

  useEffect(() => () => cancelHoverClose(), []);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function rememberLocale(locale: LocaleCode) {
    // The locale preference is deliberately non-sensitive and must survive navigation.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }

  function revealMenu() {
    cancelHoverClose();
    onOpen?.();
    setIsOpen(true);
  }

  return (
    <div
      className={`locale-menu ${isOpen ? "is-open" : ""}`}
      onFocusCapture={onOpen}
      onMouseEnter={revealMenu}
      onMouseLeave={scheduleHoverClose}
      ref={rootRef}
    >
      <button
        aria-controls="site-language-menu"
        aria-expanded={isOpen}
        aria-label={`${label}: ${activeLanguage.nativeLabel}`}
        className="locale-menu__trigger"
        onClick={revealMenu}
        ref={triggerRef}
        type="button"
      >
        <LanguageFlag language={activeLanguage} variant="trigger" />
        <span className="locale-menu__current" lang={activeLanguage.languageTag}>
          {activeLanguage.nativeLabel}
        </span>
        <svg aria-hidden="true" className="locale-menu__chevron" viewBox="0 0 12 8">
          <path d="m1 1.5 5 5 5-5" />
        </svg>
      </button>

      {isOpen ? (
        <div
          aria-label={label}
          className="locale-menu__panel"
          id="site-language-menu"
          onMouseEnter={cancelHoverClose}
        >
          <span className="locale-menu__eyebrow">{label}</span>
          <div className="locale-menu__options">
            {languages.map((metadata) => {
              const locale = metadata.code;
              const isCurrent = locale === currentLocale;
              return (
                <Link
                  aria-current={isCurrent ? "page" : undefined}
                  aria-label={metadata.nativeLabel}
                  className="locale-menu__option"
                  href={switchPathLocale(pathname, locale)}
                  key={locale}
                  lang={metadata.languageTag}
                  onClick={() => {
                    rememberLocale(locale);
                    setIsOpen(false);
                  }}
                >
                  <LanguageFlag language={metadata} variant="option" />
                  <span className="locale-menu__option-copy">
                    <strong>{metadata.nativeLabel}</strong>
                    {metadata.label !== metadata.nativeLabel ? <small>{metadata.label}</small> : null}
                  </span>
                  {isCurrent ? (
                    <svg aria-hidden="true" className="locale-menu__check" viewBox="0 0 16 16">
                      <path d="m3 8.2 3.1 3.1L13 4.7" />
                    </svg>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
