"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import type { LanguageDto, LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Container";
import { ChevronDownIcon, CloseIcon, MenuIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";
import { BrandLink } from "./BrandLogo";
import { LocaleLink } from "./LocaleLink";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { MegaMenu, type MenuKey } from "./mega-menu/MegaMenu";
import type { NavigationMockData, PrimaryNavigationItem } from "@/types/navigation";
import { localized } from "@/types/navigation";

const MENU_IDS: Record<MenuKey, string> = {
  products: "maglive-mega-products",
  solutions: "maglive-mega-solutions",
  cases: "maglive-mega-cases",
  news: "maglive-mega-news",
  documents: "maglive-mega-documents",
  services: "maglive-mega-services",
};

/* Must match the panel transition in `public.css` so the content stays mounted
   for exactly as long as the collapse animation runs. */
const MENU_COLLAPSE_MS = 300;

function isActivePath(pathname: string, href: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const current = segments.slice(1).join("/");
  const target = href.replace(/^\//, "");
  if (target === "") return current === "";
  return current === target || current.startsWith(`${target}/`);
}

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
  const [panelMenu, setPanelMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<MenuKey | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousPathname = useRef(pathname);

  const primaryItems = navigationData.primaryItems;
  const navItems = primaryItems.filter((item) => item.id !== "contact");
  const contactItem = primaryItems.find((item) => item.id === "contact") ?? {
    id: "contact",
    label: { en: dictionary.navigation.contact, zh: dictionary.navigation.contact },
    href: "/contact",
  };

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) clearTimeout(closeTimer.current);
  }, []);

  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  }, [cancelClose]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  useEffect(() => {
    if (openMenu !== null || panelMenu === null) return;
    panelTimer.current = setTimeout(() => {
      panelTimer.current = null;
      setPanelMenu(null);
    }, MENU_COLLAPSE_MS);
    return () => {
      if (panelTimer.current === null) return;
      clearTimeout(panelTimer.current);
      panelTimer.current = null;
    };
  }, [openMenu, panelMenu]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenMenu(null);
      setMobileOpen(false);
      setMobileSection(null);
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
  }, []);

  useEffect(() => {
    document.body.classList.toggle("nav-menu-open", mobileOpen || openMenu !== null);
    return () => document.body.classList.remove("nav-menu-open");
  }, [mobileOpen, openMenu]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    cancelClose();
    const resetTimer = window.setTimeout(() => {
      setOpenMenu(null);
      setMobileOpen(false);
      setMobileSection(null);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [pathname, cancelClose]);

  function openDesktopMenu(key: MenuKey) {
    cancelClose();
    setMobileOpen(false);
    setPanelMenu(key);
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

  function closeNavigation() {
    cancelClose();
    setOpenMenu(null);
    closeMobile();
  }

  function closeAfterLinkClick(event: MouseEvent<HTMLElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest("a") !== null) closeNavigation();
  }

  function closeAfterFocusLeaves(event: FocusEvent<HTMLElement>) {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setOpenMenu(null);
  }

  const activeItemId = navItems.find(
    (item) => item.menu === undefined && isActivePath(pathname, item.href),
  )?.id ?? navItems.find((item) => isActivePath(pathname, item.href))?.id;
  const panelItem = panelMenu === null ? undefined : navItems.find((item) => item.menu === panelMenu);

  return (
    <header
      className={`site-header ${scrolled ? "site-header--scrolled" : ""} ${openMenu ? "site-header--menu-open" : ""}`}
      onBlur={closeAfterFocusLeaves}
      onClickCapture={closeAfterLinkClick}
      onMouseLeave={scheduleClose}
    >
      <Container className="site-header__inner">
        <BrandLink href="/" label={dictionary.brand.name} locale={locale} onClick={closeMobile} />

        <nav aria-label={dictionary.accessibility.primaryNavigation} className="primary-nav">
          <ul className="primary-nav__list">
            {navItems.map((item) => (
              <li className="primary-nav__item" key={item.id}>
                <NavItem
                  active={item.id === activeItemId}
                  item={item}
                  locale={locale}
                  menuOpen={item.menu !== undefined && openMenu === item.menu}
                  onEnter={() => (item.menu === undefined ? cancelClose() : openDesktopMenu(item.menu))}
                  onFocus={() => (item.menu === undefined ? setOpenMenu(null) : openDesktopMenu(item.menu))}
                />
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-header__actions">
          <LocaleSwitcher
            currentLocale={locale}
            label={dictionary.accessibility.languageSwitcher}
            languages={languages}
            onOpen={closeNavigation}
          />
          <LocaleLink className="site-header__cta" href={contactItem.href} locale={locale}>
            {localized(contactItem.label, locale)}
          </LocaleLink>
          <button
            aria-controls="maglive-mobile-menu"
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? dictionary.menu.closeMenu : dictionary.menu.openMenu}
            className="nav-toggle"
            onClick={toggleMobile}
            type="button"
          >
            {mobileOpen ? <CloseIcon className="nav-toggle__glyph" /> : <MenuIcon className="nav-toggle__glyph" />}
          </button>
        </div>
      </Container>

      <div
        className={`mega-menu-shell ${openMenu === null ? "" : "is-open"}`.trim()}
        inert={openMenu === null}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        {panelMenu === null ? null : (
          <MegaMenu
            active={panelMenu}
            data={navigationData}
            dictionary={dictionary}
            locale={locale}
            menuId={MENU_IDS[panelMenu]}
            menuLabel={localized(panelItem?.label ?? { en: "", zh: "" }, locale)}
          />
        )}
      </div>

      <div
        aria-hidden={!mobileOpen}
        className={`mobile-menu ${mobileOpen ? "is-open" : ""}`}
        id="maglive-mobile-menu"
        inert={!mobileOpen}
      >
        <div className="mobile-menu__scroll">
          <div className="mobile-menu__intro">
            <span>MAGLIVE / NAVIGATION</span>
            <p>{dictionary.brand.descriptor}</p>
          </div>

          {navItems.map((item) =>
            item.menu !== undefined ? (
              <div className="mobile-menu__section" key={item.id}>
                <button
                  aria-controls={`maglive-mobile-${item.menu}`}
                  aria-expanded={mobileSection === item.menu}
                  className="mobile-menu__section-trigger"
                  onClick={() => setMobileSection(mobileSection === item.menu ? null : item.menu!)}
                  type="button"
                >
                  <span>{localized(item.label, locale)}</span>
                  <span aria-hidden="true" className="mobile-menu__section-glyph">
                    {mobileSection === item.menu ? <MinusIcon /> : <PlusIcon />}
                  </span>
                </button>
                <div
                  className={`mobile-menu__section-body ${mobileSection === item.menu ? "is-open" : ""}`}
                  id={`maglive-mobile-${item.menu}`}
                >
                  <div className="mobile-menu__section-inner">
                    {item.menu === "products" ? (
                      <>
                        {navigationData.productCategories.map((link) => (
                          <MobileLink
                            href={link.href}
                            key={localized(link.label, locale)}
                            label={localized(link.label, locale)}
                            locale={locale}
                            meta={localized(link.description, locale)}
                            onClick={closeMobile}
                          />
                        ))}
                        {navigationData.featuredProducts.map((link) => (
                          <MobileLink
                            href={link.href}
                            key={localized(link.label, locale)}
                            label={localized(link.label, locale)}
                            locale={locale}
                            meta={localized(link.tag, locale)}
                            onClick={closeMobile}
                          />
                        ))}
                      </>
                    ) : null}
                    {item.menu === "solutions" ? (
                      <>
                        {navigationData.solutionCategories.map((link) => (
                          <MobileLink
                            href={link.href}
                            key={localized(link.label, locale)}
                            label={localized(link.label, locale)}
                            locale={locale}
                            onClick={closeMobile}
                          />
                        ))}
                        <MobileLink
                          href={navigationData.featuredSolution.href}
                          label={localized(navigationData.featuredSolution.label, locale)}
                          locale={locale}
                          meta={localized(navigationData.featuredSolution.kicker, locale)}
                          onClick={closeMobile}
                        />
                      </>
                    ) : null}
                    {item.menu === "cases"
                      ? navigationData.cases.map((link) => (
                          <MobileLink
                            href={link.href}
                            key={localized(link.label, locale)}
                            label={localized(link.label, locale)}
                            locale={locale}
                            meta={localized(link.location, locale)}
                            onClick={closeMobile}
                          />
                        ))
                      : null}
                    {item.menu === "news"
                      ? navigationData.news.map((link) => (
                          <MobileLink
                            href={link.href}
                            key={localized(link.label, locale)}
                            label={localized(link.label, locale)}
                            locale={locale}
                            meta={localized(link.date, locale)}
                            onClick={closeMobile}
                          />
                        ))
                      : null}
                    {item.menu === "documents"
                      ? navigationData.documents.map((link) => (
                          <MobileLink
                            href={link.href}
                            key={localized(link.label, locale)}
                            label={localized(link.label, locale)}
                            locale={locale}
                            onClick={closeMobile}
                          />
                        ))
                      : null}
                    {item.menu === "services"
                      ? navigationData.services.map((link) => (
                          <MobileLink
                            href={link.href}
                            key={localized(link.label, locale)}
                            label={localized(link.label, locale)}
                            locale={locale}
                            onClick={closeMobile}
                          />
                        ))
                      : null}
                    <MobileLink
                      href={item.href}
                      label={`${dictionary.menu.viewAll} ${localized(item.label, locale)}`}
                      locale={locale}
                      onClick={closeMobile}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <LocaleLink
                className="mobile-menu__direct-link"
                href={item.href}
                key={item.id}
                locale={locale}
                onClick={closeMobile}
              >
                <span>{localized(item.label, locale)}</span>
              </LocaleLink>
            ),
          )}

          <LocaleLink className="mobile-menu__contact" href={contactItem.href} locale={locale} onClick={closeMobile}>
            <span>{localized(contactItem.label, locale)}</span>
          </LocaleLink>
        </div>
      </div>
    </header>
  );
}

function NavItem({
  item,
  locale,
  active,
  menuOpen,
  onEnter,
  onFocus,
}: {
  item: PrimaryNavigationItem;
  locale: LocaleCode;
  active: boolean;
  menuOpen: boolean;
  onEnter: () => void;
  onFocus: () => void;
}) {
  return (
    <LocaleLink
      aria-current={active ? "page" : undefined}
      className={`primary-nav__link ${active ? "is-active" : ""} ${menuOpen ? "is-open" : ""}`.trim()}
      href={item.href}
      locale={locale}
      onFocus={onFocus}
      onMouseEnter={onEnter}
    >
      <span>{localized(item.label, locale)}</span>
      {item.menu === undefined ? null : (
        <ChevronDownIcon aria-hidden="true" className="primary-nav__chevron" />
      )}
    </LocaleLink>
  );
}

function MobileLink({
  href,
  label,
  meta,
  locale,
  onClick,
}: {
  href: string;
  label: string;
  meta?: string;
  locale: LocaleCode;
  onClick: () => void;
}) {
  return (
    <LocaleLink className="mobile-menu__link" href={href} locale={locale} onClick={onClick}>
      <span>
        <strong>{label}</strong>
        {meta ? <small>{meta}</small> : null}
      </span>
    </LocaleLink>
  );
}
