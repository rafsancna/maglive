"use client";

import { useEffect, useRef, useState } from "react";
import type { LanguageDto, LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Container";
import { BrandLink } from "./BrandLogo";
import { LocaleLink } from "./LocaleLink";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MegaMenu, type MenuKey } from "./mega-menu/MegaMenu";
import type { NavigationMockData } from "@/types/navigation";
import { localized } from "@/types/navigation";

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
  const primaryItems = navigationData.primaryItems;
  const contactItem = primaryItems.find((item) => item.id === "contact");

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
        <BrandLink href="/" label={dictionary.brand.name} locale={locale} onClick={closeMobile} />

        <nav aria-label={dictionary.accessibility.primaryNavigation} className="primary-nav">
          {primaryItems.map((item) => item.menu !== undefined ? (
            <button
              aria-controls={menuId}
              aria-expanded={openMenu === item.menu}
              aria-haspopup="true"
              className={`primary-nav__trigger ${openMenu === item.menu ? "is-active" : ""}`}
              key={item.id}
              onClick={() => openMenu === item.menu ? setOpenMenu(null) : openDesktopMenu(item.menu!)}
              onFocus={() => openDesktopMenu(item.menu!)}
              onMouseEnter={() => openDesktopMenu(item.menu!)}
              ref={(element) => { if (element && item.menu !== undefined) triggerRefs.current[item.menu] = element; }}
              type="button"
            >
              {localized(item.label, locale)}<span aria-hidden="true" className="primary-nav__chevron">⌄</span>
            </button>
          ) : (
            <LocaleLink className="primary-nav__link" href={item.href} key={item.id} locale={locale}>{localized(item.label, locale)}</LocaleLink>
          ))}
        </nav>

        <div className="site-header__actions">
          <LocaleSwitcher currentLocale={locale} label={dictionary.accessibility.languageSwitcher} languages={languages} />
          <button aria-controls="maglive-mobile-menu" aria-expanded={mobileOpen} aria-label={mobileOpen ? dictionary.menu.closeMenu : dictionary.menu.openMenu} className={`nav-toggle ${mobileOpen ? "is-active" : ""}`} onClick={toggleMobile} type="button">
            <span aria-hidden="true" className="nav-toggle__icon"><i /><i /></span>
          </button>
        </div>
      </Container>

      {openMenu ? <MegaMenu active={openMenu} data={navigationData} dictionary={dictionary} locale={locale} menuId={menuId} menuLabel={localized(primaryItems.find((item) => item.menu === openMenu)?.label ?? { en: dictionary.navigation[openMenu] }, locale)} /> : null}

      <div className={`mobile-menu ${mobileOpen ? "is-open" : ""}`} id="maglive-mobile-menu" aria-hidden={!mobileOpen}>
        <div className="mobile-menu__scroll">
          <div className="mobile-menu__intro"><span>MAGLIVE / NAVIGATION</span><p>{locale === "zh" ? "从清晰的入口开始探索。" : "Start with a clearer way in."}</p></div>
          {primaryItems.map((item) => item.id === "contact" ? null : item.menu !== undefined ? (
            <div className="mobile-menu__section" key={item.id}>
              <button aria-expanded={mobileSection === item.menu} className="mobile-menu__section-trigger" onClick={() => setMobileSection(mobileSection === item.menu ? null : item.menu!)} type="button"><span>{localized(item.label, locale)}</span><span aria-hidden="true">{mobileSection === item.menu ? "−" : "+"}</span></button>
              <div className={`mobile-menu__section-body ${mobileSection === item.menu ? "is-open" : ""}`}>
                {item.menu === "products" ? <>
                  {navigationData.productCategories.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} locale={locale} onClick={closeMobile} />)}
                  {navigationData.featuredProducts.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} meta={localized(link.tag, locale)} locale={locale} onClick={closeMobile} />)}
                </> : null}
                {item.menu === "solutions" ? <>
                  {navigationData.solutionCategories.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} locale={locale} onClick={closeMobile} />)}
                  <MobileLink href={navigationData.featuredSolution.href} label={localized(navigationData.featuredSolution.label, locale)} meta={localized(navigationData.featuredSolution.kicker, locale)} locale={locale} onClick={closeMobile} />
                </> : null}
                {item.menu === "cases" ? navigationData.cases.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} meta={localized(link.location, locale)} locale={locale} onClick={closeMobile} />) : null}
                {item.menu === "news" ? navigationData.news.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} meta={localized(link.date, locale)} locale={locale} onClick={closeMobile} />) : null}
                {item.menu === "documents" ? navigationData.documents.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} locale={locale} onClick={closeMobile} />) : null}
                {item.menu === "services" ? navigationData.services.map((link) => <MobileLink key={localized(link.label, locale)} href={link.href} label={localized(link.label, locale)} locale={locale} onClick={closeMobile} />) : null}
                <MobileLink href={item.href} label={`${dictionary.menu.viewAll} ${localized(item.label, locale)}`} locale={locale} onClick={closeMobile} />
              </div>
            </div>
          ) : <LocaleLink className="mobile-menu__direct-link" href={item.href} key={item.id} locale={locale} onClick={closeMobile}>{localized(item.label, locale)}<span aria-hidden="true">↗</span></LocaleLink>)}
          {contactItem ? <LocaleLink className="mobile-menu__contact" href={contactItem.href} locale={locale} onClick={closeMobile}><span>{localized(contactItem.label, locale)}</span><span aria-hidden="true">↗</span></LocaleLink> : null}
        </div>
      </div>
    </header>
  );
}

function MobileLink({ href, label, meta, locale, onClick }: { href: string; label: string; meta?: string; locale: LocaleCode; onClick: () => void }) {
  return <LocaleLink className="mobile-menu__link" href={href} locale={locale} onClick={onClick}><span><strong>{label}</strong>{meta ? <small>{meta}</small> : null}</span><span aria-hidden="true">↗</span></LocaleLink>;
}
