"use client";

import Image from "next/image";
import { useState, type FocusEventHandler, type MouseEventHandler, type ReactNode } from "react";
import type { LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "@/i18n/dictionary";
import { LocaleLink } from "@/components/site/LocaleLink";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { localized, type NavigationMockData, type NavigationLink, type FeaturedProduct } from "@/types/navigation";

export type MenuKey = "products" | "solutions" | "cases" | "news" | "documents" | "services";

type MegaMenuProps = {
  active: MenuKey;
  data: NavigationMockData;
  dictionary: Dictionary;
  locale: LocaleCode;
  menuId: string;
  menuLabel: string;
};

function Arrow() {
  return <ArrowUpRightIcon className="mega-menu__arrow" />;
}

function MenuLink({ item, locale, className = "", prefix, onMouseEnter, onFocus }: { item: NavigationLink; locale: LocaleCode; className?: string; prefix?: ReactNode; onMouseEnter?: MouseEventHandler<HTMLAnchorElement>; onFocus?: FocusEventHandler<HTMLAnchorElement> }) {
  return (
    <LocaleLink className={`mega-menu__link ${className}`.trim()} href={item.href} locale={locale} {...(onFocus === undefined ? {} : { onFocus })} {...(onMouseEnter === undefined ? {} : { onMouseEnter })}>
      {prefix}
      <span>
        <strong>{localized(item.label, locale)}</strong>
        {item.description ? <small>{localized(item.description, locale)}</small> : null}
      </span>
      <Arrow />
    </LocaleLink>
  );
}

export function MegaMenu({ active, data, dictionary, locale, menuId, menuLabel }: MegaMenuProps) {
  return (
    <div
      aria-label={menuLabel}
      className={`mega-menu mega-menu--${active}`}
      id={menuId}
      role="region"
    >
      <div className="container mega-menu__inner">
        {active === "products" ? (
          <ProductsMenu data={data} dictionary={dictionary} locale={locale} menuLabel={menuLabel} />
        ) : null}
        {active === "solutions" ? (
          <SolutionsMenu data={data} dictionary={dictionary} locale={locale} menuLabel={menuLabel} />
        ) : null}
        {active === "cases" ? (
          <CasesMenu data={data} dictionary={dictionary} locale={locale} menuLabel={menuLabel} />
        ) : null}
        {active === "news" ? (
          <NewsMenu data={data} dictionary={dictionary} locale={locale} menuLabel={menuLabel} />
        ) : null}
        {active === "documents" ? (
          <SimpleMenu items={data.documents} locale={locale} title={menuLabel} action={dictionary.menu.viewDocuments} href="/downloads" />
        ) : null}
        {active === "services" ? (
          <SimpleMenu items={data.services} locale={locale} title={menuLabel} action={dictionary.menu.viewServices} href="/contact" />
        ) : null}
      </div>
    </div>
  );
}

function MenuHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <header className="mega-menu__heading">
      <span className="mega-menu__eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
    </header>
  );
}

/**
 * Some menus are configured through the admin but not yet populated. Rather
 * than opening an empty panel, they show a single clear destination so the
 * dropdown keeps the same composed shape as every other menu.
 */
function EmptyPanel({ href, label, locale }: { href: string; label: string; locale: LocaleCode }) {
  return (
    <LocaleLink className="mega-menu__empty" href={href} locale={locale}>
      <span>{label}</span>
      <Arrow />
    </LocaleLink>
  );
}

function ProductsMenu({ data, dictionary, locale, menuLabel }: Omit<MegaMenuProps, "active" | "menuId">) {
  const [activeCategoryId, setActiveCategoryId] = useState(data.productCategories[0]?.id ?? data.productCategories[0]?.accent ?? null);
  const activeCategory = data.productCategories.find((item) => (item.id ?? item.accent) === activeCategoryId) ?? data.productCategories[0];
  const activeProducts: readonly FeaturedProduct[] = activeCategory?.products?.length ? activeCategory.products : data.featuredProducts;
  return (
    <div className="mega-menu__layout mega-menu__layout--products">
      <MenuHeading eyebrow="01 / CATALOG" title={menuLabel} description={locale === "zh" ? "从组件到系统，找到适配项目的技术组合。" : "From modules to complete systems, find the right technical fit."} />
      <div className="mega-menu__products-grid">
        <section className="mega-menu__category-panel" aria-labelledby="products-category-title">
          <div className="mega-menu__section-label" id="products-category-title">{locale === "zh" ? "产品类别" : "Product categories"}</div>
          <div className="mega-menu__category-list">
            {data.productCategories.map((item) => (
              <LocaleLink aria-current={(item.id ?? item.accent) === activeCategoryId ? "true" : undefined} className={`mega-menu__category ${(item.id ?? item.accent) === activeCategoryId ? "is-active" : ""}`} href={item.href} key={item.id ?? item.accent} locale={locale} onFocus={() => setActiveCategoryId(item.id ?? item.accent)} onMouseEnter={() => setActiveCategoryId(item.id ?? item.accent)}>
                <span className="mega-menu__category-index">{item.accent}</span>
                <span><strong>{localized(item.label, locale)}</strong><small>{localized(item.description, locale)}</small></span>
                <Arrow />
              </LocaleLink>
            ))}
          </div>
          <LocaleLink className="mega-menu__all-link" href="/products" locale={locale}>{dictionary.menu.viewAll} {menuLabel}<Arrow /></LocaleLink>
        </section>
        <section className="mega-menu__feature-panel" aria-labelledby="products-feature-title">
          <div className="mega-menu__section-label" id="products-feature-title">{dictionary.menu.featured}{activeCategory ? ` / ${localized(activeCategory.label, locale)}` : ""}</div>
          <div className="mega-menu__feature-grid">
            {activeProducts.map((item) => (
              <LocaleLink className="mega-menu__product-card" href={item.href} key={localized(item.label, locale)} locale={locale}>
                <span className="mega-menu__product-image"><Image alt={localized(item.image.alt, locale)} height={item.image.height} loading="lazy" sizes="(max-width: 64rem) 45vw, 18rem" src={item.image.src} width={item.image.width} /></span>
                <span className="mega-menu__product-copy"><small>{localized(item.tag, locale)}</small><strong>{localized(item.label, locale)}</strong><span>{localized(item.description, locale)}</span><Arrow /></span>
              </LocaleLink>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SolutionsMenu({ data, dictionary, locale, menuLabel }: Omit<MegaMenuProps, "active" | "menuId">) {
  const [activeSolutionId, setActiveSolutionId] = useState(data.solutionCategories[0]?.id ?? null);
  const activeSolution = data.solutionCategories.find((item) => item.id === activeSolutionId) ?? data.solutionCategories[0];
  const activeFeature = activeSolution?.feature ?? data.featuredSolution;
  return (
    <div className="mega-menu__layout mega-menu__layout--solutions">
      <MenuHeading eyebrow="02 / SYSTEMS" title={menuLabel} description={locale === "zh" ? "以系统视角，为每种能源场景设计清晰路径。" : "A systems view that makes every energy scenario easier to navigate."} />
      <div className="mega-menu__solutions-grid">
        <section className="mega-menu__solution-list" aria-labelledby="solutions-list-title">
          <div className="mega-menu__section-label" id="solutions-list-title">{locale === "zh" ? "应用场景" : "Applications"}</div>
          {data.solutionCategories.map((item, index) => <MenuLink item={item} key={localized(item.label, locale)} locale={locale} className={`mega-menu__solution-link mega-menu__solution-link--${index + 1} ${item.id === activeSolutionId ? "is-active" : ""}`} onFocus={() => setActiveSolutionId(item.id ?? null)} onMouseEnter={() => setActiveSolutionId(item.id ?? null)} prefix={<span className="mega-menu__solution-index">0{index + 1}</span>} />)}
        </section>
        <LocaleLink className="mega-menu__solution-feature" href={activeFeature.href} locale={locale}>
          <Image alt={localized(activeFeature.image.alt, locale)} fill loading="lazy" sizes="(max-width: 64rem) 100vw, 42rem" src={activeFeature.image.src} />
          <span className="mega-menu__solution-overlay" />
          <span className="mega-menu__solution-copy"><small>{localized(activeFeature.kicker, locale)}</small><strong>{localized(activeFeature.label, locale)}</strong><span>{localized(activeFeature.description, locale)}</span><span className="mega-menu__feature-action">{dictionary.menu.explore} <Arrow /></span></span>
        </LocaleLink>
      </div>
    </div>
  );
}

function CasesMenu({ data, dictionary, locale, menuLabel }: Omit<MegaMenuProps, "active" | "menuId">) {
  return (
    <div className="mega-menu__layout mega-menu__layout--cases">
      <div className="mega-menu__cases-head"><MenuHeading eyebrow="03 / DELIVERY" title={menuLabel} description={locale === "zh" ? "每个项目都将工程、现场与长期表现连接起来。" : "Where engineering, place and long-term performance come together."} /><LocaleLink className="mega-menu__all-link" href="/projects" locale={locale}>{dictionary.menu.allCases}<Arrow /></LocaleLink></div>
      {data.cases.length === 0 ? (
        <EmptyPanel href="/projects" label={dictionary.menu.allCases} locale={locale} />
      ) : (
        <div className="mega-menu__case-grid">
          {data.cases.map((item, index) => (
            <LocaleLink className={`mega-menu__case-card mega-menu__case-card--${index + 1}`} href={item.href} key={localized(item.label, locale)} locale={locale}>
              <span className="mega-menu__case-image"><Image alt={localized(item.image.alt, locale)} height={item.image.height} loading="lazy" sizes="(max-width: 46rem) 100vw, 30vw" src={item.image.src} width={item.image.width} /><span className="mega-menu__case-number">0{index + 1}</span></span>
              <span className="mega-menu__case-copy"><small>{localized(item.description, locale)}</small><strong>{localized(item.label, locale)}</strong><span>{localized(item.location, locale)} · {localized(item.capacity, locale)}</span></span>
              <Arrow />
            </LocaleLink>
          ))}
        </div>
      )}
    </div>
  );
}

function NewsMenu({ data, dictionary, locale, menuLabel }: Omit<MegaMenuProps, "active" | "menuId">) {
  const [featured, ...rest] = data.news;
  return (
    <div className="mega-menu__layout mega-menu__layout--news">
      <div className="mega-menu__cases-head"><MenuHeading eyebrow="04 / JOURNAL" title={menuLabel} description={locale === "zh" ? "来自 Maglive 的公司动态、行业洞察与技术观点。" : "Company updates, industry insight and technology perspectives from Maglive."} /><LocaleLink className="mega-menu__all-link" href="/news" locale={locale}>{dictionary.menu.allNews}<Arrow /></LocaleLink></div>
      {data.news.length === 0 ? (
        <EmptyPanel href="/news" label={dictionary.menu.allNews} locale={locale} />
      ) : (
        <div className={`mega-menu__news-grid${rest.length === 0 ? " mega-menu__news-grid--single" : ""}`}>
          {featured ? <LocaleLink className="mega-menu__news-feature" href={featured.href} locale={locale}><span className="mega-menu__news-image"><Image alt={localized(featured.image.alt, locale)} fill loading="lazy" sizes="(max-width: 46rem) 100vw, 42rem" src={featured.image.src} /></span><span className="mega-menu__news-copy"><small>{localized(featured.category, locale)} · {localized(featured.date, locale)}</small><strong>{localized(featured.label, locale)}</strong><span>{dictionary.menu.readMore} <Arrow /></span></span></LocaleLink> : null}
          {rest.length === 0 ? null : (
            <div className="mega-menu__news-list">{rest.map((item) => <MenuLink item={{ ...item, description: { ...item.category, en: `${localized(item.category, locale)} · ${localized(item.date, locale)}` } }} key={localized(item.label, locale)} locale={locale} />)}</div>
          )}
        </div>
      )}
    </div>
  );
}

function SimpleMenu({ items, locale, title, action, href }: { items: readonly NavigationLink[]; locale: LocaleCode; title: string; action: string; href: string }) {
  return (
    <div className="mega-menu__layout mega-menu__layout--simple">
      <MenuHeading eyebrow="05 / RESOURCES" title={title} description={locale === "zh" ? "为项目团队准备的清晰、可靠信息。" : "Clear, dependable information for teams moving projects forward."} />
      {items.length === 0 ? (
        <EmptyPanel href={href} label={action} locale={locale} />
      ) : (
        <>
          <div className="mega-menu__simple-grid">{items.map((item, index) => <MenuLink item={item} key={localized(item.label, locale)} locale={locale} className="mega-menu__simple-link" prefix={<span className="mega-menu__simple-index">0{index + 1}</span>} />)}</div>
          <LocaleLink className="mega-menu__all-link" href={href} locale={locale}>{action}<Arrow /></LocaleLink>
        </>
      )}
    </div>
  );
}
