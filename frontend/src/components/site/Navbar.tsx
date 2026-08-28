"use client";

import { useEffect, useRef, useState } from "react";
import type { LanguageDto, LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Container";
import { LocaleLink } from "./LocaleLink";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MegaMenu, type MenuKey } from "./mega-menu/MegaMenu";
import type { NavigationMockData } from "@/types/navigation";
import { localized } from "@/types/navigation";

const primaryItems = [
  { key: "products", href: "/products", menu: true },
  { key: "solutions", href: "/projects", menu: true },
  { key: "cases", href: "/projects", menu: true },
  { key: "news", href: "/news", menu: true },
  { key: "documents", href: "/downloads", menu: true },
  { key: "services", href: "/contact", menu: true },
  { key: "about", href: "/about", menu: false },
  { key: "contact", href: "/contact", menu: false },
] as const;

type PrimaryItem = (typeof primaryItems)[number];

export function Navbar({
  dictionary,
  locale,
  languages,
  navigationData,
}: {
  dictionary: Dictionary;
  locale: LocaleCode;
  languages: readonly LanguageDto[];
  navigationData: NavigationMockData;
}) {
  const [openMenu, setOpenMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<MenuKey | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerRefs = useRef<Partial<Record<MenuKey, HTMLButtonElement>>>({});
  const menuId = "maglive-primary-mega-menu";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
        setMobileSection(null);
        if (openMenu !== null) triggerRefs.current[openMenu]?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && !document.querySelector(".site-header")?.contains(target)) {
        setOpenMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openMenu]);

  useEffect(() => {
    document.body.classList.toggle("nav-menu-open", mobileOpen || openMenu !== null);
    return () => document.body.classList.remove("nav-menu-open");
  }, [mobileOpen, openMenu]);

  function cancelClose() {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }

  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), 240);
  }

  function openDesktopMenu(key: MenuKey) {
    cancelClose();
    setMobileOpen(false);
    setOpenMenu(key);
  }

  function toggleMobile() {
    setOpenMenu(null);
    setMobileOpen((value) => !value);
    setMobileSection(null);
  }

  function closeMobile() {
    setMobileOpen(false);
    setMobileSection(null);
  }

  return (
    <header className={`site-header ${scrolled ? "site-header--scrolled" : ""} ${openMenu ? "site-header--menu-open" : ""}`} onMouseEnter={cancelClose} onMouseLeave={scheduleClose}>
      <Container className="site-header__inner">
        <LocaleLink aria-label={dictionary.brand.name} className="brand" href="/" locale={locale} onClick={closeMobile}>
          <span className="brand__mark" aria-hidden="true">M</span>
          <span className="brand__wordmark"><strong>{dictionary.brand.name}</strong><small>{dictionary.brand.descriptor}</small></span>
        </LocaleLink>

        <nav aria-label={dictionary.accessibility.primaryNavigation} className="primary-nav">
          {primaryItems.map((item: PrimaryItem) => item.menu ? (
            <button
              aria-controls={menuId}
              aria-expanded={openMenu === item.key}
              aria-haspopup="true"
              className={`primary-nav__trigger ${openMenu === item.key ? "is-active" : ""}`}
              key={item.key}
              onClick={() => openMenu === item.key ? setOpenMenu(null) : openDesktopMenu(item.key as MenuKey)}
              onFocus={() => openDesktopMenu(item.key as MenuKey)}
              onMouseEnter={() => openDesktopMenu(item.key as MenuKey)}
              ref={(element) => { if (element) triggerRefs.current[item.key as MenuKey] = element; }}
              type="button"
            >
              {dictionary.navigation[item.key]}<span aria-hidden="true" className="primary-nav__chevron">⌄</span>
            </button>
          ) : (
            <LocaleLink className="primary-nav__link" href={item.href} key={item.key} locale={locale}>{dictionary.navigation[item.key]}</LocaleLink>
          ))}
        </nav>

        <div className="site-header__actions">
          <LocaleSwitcher currentLocale={locale} label={dictionary.accessibility.languageSwitcher} languages={languages} />
          <button aria-controls="maglive-mobile-menu" aria-expanded={mobileOpen} aria-label={mobileOpen ? dictionary.menu.closeMenu : dictionary.menu.openMenu} className={`nav-toggle ${mobileOpen ? "is-active" : ""}`} onClick={toggleMobile} type="button">
            <span aria-hidden="true" className="nav-toggle__icon"><i /><i /></span>
          </button>
        </div>
      </Container>

      {openMenu ? <MegaMenu active={openMenu} data={navigationData} dictionary={dictionary} locale={locale} menuId={menuId} /> : null}

      <div className={`mobile-menu ${mobileOpen ? "is-open" : ""}`} id="maglive-mobile-menu" aria-hidden={!mobileOpen}>
        <div className="mobile-menu__scroll">
          <div className="mobile-menu__intro"><span>MAGLIVE / NAVIGATION</span><p>{locale === "zh" ? "从清晰的入口开始探索。" : "Start with a clearer way in."}</p></div>
          {primaryItems.map((item: PrimaryItem) => item.key === "contact" ? null : item.menu ? (
            <div className="mobile-menu__section" key={item.key}>
              <button aria-expanded={mobileSection === item.key} className="mobile-menu__section-trigger" onClick={() => setMobileSection(mobileSection === item.key ? null : item.key as MenuKey)} type="button"><span>{dictionary.navigation[item.key]}</span><span aria-hidden="true">{mobileSection === item.key ? "−" : "+"}</span></button>
              <div className={`mobile-menu__section-body ${mobileSection === item.key ? "is-open" : ""}`}>
                {item.key === "products" ? <>
                  {navigationData.productCategories.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} locale={locale} onClick={closeMobile} />)}
                  {navigationData.featuredProducts.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} meta={localized(link.tag, locale)} locale={locale} onClick={closeMobile} />)}
                </> : null}
                {item.key === "solutions" ? <>
                  {navigationData.solutionCategories.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} locale={locale} onClick={closeMobile} />)}
                  <MobileLink href={navigationData.featuredSolution.href} label={localized(navigationData.featuredSolution.label, locale)} meta={localized(navigationData.featuredSolution.kicker, locale)} locale={locale} onClick={closeMobile} />
                </> : null}
                {item.key === "cases" ? navigationData.cases.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} meta={localized(link.location, locale)} locale={locale} onClick={closeMobile} />) : null}
                {item.key === "news" ? navigationData.news.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} meta={localized(link.date, locale)} locale={locale} onClick={closeMobile} />) : null}
                {item.key === "documents" ? navigationData.documents.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} locale={locale} onClick={closeMobile} />) : null}
                {item.key === "services" ? navigationData.services.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} locale={locale} onClick={closeMobile} />) : null}
                <MobileLink href={item.href} label={`${dictionary.menu.viewAll} ${dictionary.navigation[item.key]}`} locale={locale} onClick={closeMobile} />
              </div>
            </div>
          ) : <LocaleLink className="mobile-menu__direct-link" href={item.href} key={item.key} locale={locale} onClick={closeMobile}>{dictionary.navigation[item.key]}<span aria-hidden="true">↗</span></LocaleLink>)}
          <LocaleLink className="mobile-menu__contact" href="/contact" locale={locale} onClick={closeMobile}><span>{dictionary.navigation.contact}</span><span aria-hidden="true">↗</span></LocaleLink>
        </div>
      </div>
    </header>
  );
}

function MobileLink({ href, label, meta, locale, onClick }: { href: string; label: string; meta?: string; locale: LocaleCode; onClick: () => void }) {
  return <LocaleLink className="mobile-menu__link" href={href} locale={locale} onClick={onClick}><span><strong>{label}</strong>{meta ? <small>{meta}</small> : null}</span><span aria-hidden="true">↗</span></LocaleLink>;
}
