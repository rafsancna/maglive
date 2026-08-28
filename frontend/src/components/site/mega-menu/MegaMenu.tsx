"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "@/i18n/dictionary";
import { LocaleLink } from "@/components/site/LocaleLink";
import { localized, type NavigationMockData, type NavigationLink } from "@/types/navigation";

export type MenuKey = "products" | "solutions" | "cases" | "news" | "documents" | "services";

type MegaMenuProps = {
  active: MenuKey;
  data: NavigationMockData;
  dictionary: Dictionary;
  locale: LocaleCode;
  menuId: string;
};

function Arrow() {
  return <span aria-hidden="true" className="mega-menu__arrow">↗</span>;
}

function MenuLink({ item, locale, className = "", prefix }: { item: NavigationLink; locale: LocaleCode; className?: string; prefix?: ReactNode }) {
  return (
    <LocaleLink className={`mega-menu__link ${className}`.trim()} href={item.href} locale={locale}>
      {prefix}
      <span>
        <strong>{localized(item.label, locale)}</strong>
        {item.description ? <small>{localized(item.description, locale)}</small> : null}
      </span>
      <Arrow />
    </LocaleLink>
  );
}

export function MegaMenu({ active, data, dictionary, locale, menuId }: MegaMenuProps) {
  const menuLabel = dictionary.navigation[active];

  return (
    <div aria-label={menuLabel} className={`mega-menu mega-menu--${active}`} id={menuId} role="region">
      <div className="container mega-menu__inner">
        {active === "products" ? (
          <ProductsMenu data={data} dictionary={dictionary} locale={locale} />
        ) : null}
        {active === "solutions" ? (
          <SolutionsMenu data={data} dictionary={dictionary} locale={locale} />
        ) : null}
        {active === "cases" ? (
          <CasesMenu data={data} dictionary={dictionary} locale={locale} />
        ) : null}
        {active === "news" ? (
          <NewsMenu data={data} dictionary={dictionary} locale={locale} />
        ) : null}
        {active === "documents" ? (
          <SimpleMenu items={data.documents} locale={locale} title={dictionary.navigation.documents} action={dictionary.menu.viewDocuments} />
        ) : null}
        {active === "services" ? (
          <SimpleMenu items={data.services} locale={locale} title={dictionary.navigation.services} action={dictionary.menu.viewServices} />
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

function ProductsMenu({ data, dictionary, locale }: Omit<MegaMenuProps, "active" | "menuId">) {
  return (
    <div className="mega-menu__layout mega-menu__layout--products">
      <MenuHeading eyebrow="01 / CATALOG" title={dictionary.navigation.products} description={locale === "zh" ? "从组件到系统，找到适配项目的技术组合。" : "From modules to complete systems, find the right technical fit."} />
      <div className="mega-menu__products-grid">
        <section className="mega-menu__category-panel" aria-labelledby="products-category-title">
          <div className="mega-menu__section-label" id="products-category-title">{locale === "zh" ? "产品类别" : "Product categories"}</div>
          <div className="mega-menu__category-list">
            {data.productCategories.map((item) => (
              <LocaleLink className="mega-menu__category" href={item.href} key={item.accent} locale={locale}>
                <span className="mega-menu__category-index">{item.accent}</span>
                <span><strong>{localized(item.label, locale)}</strong><small>{localized(item.description, locale)}</small></span>
                <Arrow />
              </LocaleLink>
            ))}
          </div>
          <LocaleLink className="mega-menu__all-link" href="/products" locale={locale}>{dictionary.menu.viewAll} {dictionary.navigation.products}<Arrow /></LocaleLink>
        </section>
        <section className="mega-menu__feature-panel" aria-labelledby="products-feature-title">
          <div className="mega-menu__section-label" id="products-feature-title">{dictionary.menu.featured}</div>
          <div className="mega-menu__feature-grid">
            {data.featuredProducts.map((item) => (
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

function SolutionsMenu({ data, dictionary, locale }: Omit<MegaMenuProps, "active" | "menuId">) {
  return (
    <div className="mega-menu__layout mega-menu__layout--solutions">
      <MenuHeading eyebrow="02 / SYSTEMS" title={dictionary.navigation.solutions} description={locale === "zh" ? "以系统视角，为每种能源场景设计清晰路径。" : "A systems view that makes every energy scenario easier to navigate."} />
      <div className="mega-menu__solutions-grid">
        <section className="mega-menu__solution-list" aria-labelledby="solutions-list-title">
          <div className="mega-menu__section-label" id="solutions-list-title">{locale === "zh" ? "应用场景" : "Applications"}</div>
          {data.solutionCategories.map((item, index) => <MenuLink item={item} key={localized(item.label, locale)} locale={locale} className={`mega-menu__solution-link mega-menu__solution-link--${index + 1}`} />)}
        </section>
        <LocaleLink className="mega-menu__solution-feature" href={data.featuredSolution.href} locale={locale}>
          <Image alt={localized(data.featuredSolution.image.alt, locale)} fill loading="lazy" sizes="(max-width: 64rem) 100vw, 42rem" src={data.featuredSolution.image.src} />
          <span className="mega-menu__solution-overlay" />
          <span className="mega-menu__solution-copy"><small>{localized(data.featuredSolution.kicker, locale)}</small><strong>{localized(data.featuredSolution.label, locale)}</strong><span>{localized(data.featuredSolution.description, locale)}</span><span className="mega-menu__feature-action">{dictionary.menu.explore} <Arrow /></span></span>
        </LocaleLink>
      </div>
    </div>
  );
}

function CasesMenu({ data, dictionary, locale }: Omit<MegaMenuProps, "active" | "menuId">) {
  return (
    <div className="mega-menu__layout mega-menu__layout--cases">
      <div className="mega-menu__cases-head"><MenuHeading eyebrow="03 / DELIVERY" title={dictionary.navigation.cases} description={locale === "zh" ? "每个项目都将工程、现场与长期表现连接起来。" : "Where engineering, place and long-term performance come together."} /><LocaleLink className="mega-menu__all-link" href="/projects" locale={locale}>{dictionary.menu.allCases}<Arrow /></LocaleLink></div>
      <div className="mega-menu__case-grid">
        {data.cases.map((item, index) => (
          <LocaleLink className={`mega-menu__case-card mega-menu__case-card--${index + 1}`} href={item.href} key={localized(item.label, locale)} locale={locale}>
            <span className="mega-menu__case-image"><Image alt={localized(item.image.alt, locale)} height={item.image.height} loading="lazy" sizes="(max-width: 46rem) 100vw, 30vw" src={item.image.src} width={item.image.width} /><span className="mega-menu__case-number">0{index + 1}</span></span>
            <span className="mega-menu__case-copy"><small>{localized(item.description, locale)}</small><strong>{localized(item.label, locale)}</strong><span>{localized(item.location, locale)} · {localized(item.capacity, locale)}</span></span>
            <Arrow />
          </LocaleLink>
        ))}
      </div>
    </div>
  );
}

function NewsMenu({ data, dictionary, locale }: Omit<MegaMenuProps, "active" | "menuId">) {
  const [featured, ...rest] = data.news;
  return (
    <div className="mega-menu__layout mega-menu__layout--news">
      <div className="mega-menu__cases-head"><MenuHeading eyebrow="04 / JOURNAL" title={dictionary.navigation.news} description={locale === "zh" ? "来自 Maglive 的公司动态、行业洞察与技术观点。" : "Company updates, industry insight and technology perspectives from Maglive."} /><LocaleLink className="mega-menu__all-link" href="/news" locale={locale}>{dictionary.menu.allNews}<Arrow /></LocaleLink></div>
      <div className="mega-menu__news-grid">
        {featured ? <LocaleLink className="mega-menu__news-feature" href={featured.href} locale={locale}><span className="mega-menu__news-image"><Image alt={localized(featured.image.alt, locale)} fill loading="lazy" sizes="(max-width: 46rem) 100vw, 42rem" src={featured.image.src} /></span><span className="mega-menu__news-copy"><small>{localized(featured.category, locale)} · {localized(featured.date, locale)}</small><strong>{localized(featured.label, locale)}</strong><span>{dictionary.menu.readMore} <Arrow /></span></span></LocaleLink> : null}
        <div className="mega-menu__news-list">{rest.map((item) => <MenuLink item={{ ...item, description: { ...item.category, en: `${localized(item.category, locale)} · ${localized(item.date, locale)}` } }} key={localized(item.label, locale)} locale={locale} />)}</div>
      </div>
    </div>
  );
}

function SimpleMenu({ items, locale, title, action }: { items: readonly NavigationLink[]; locale: LocaleCode; title: string; action: string }) {
  return (
    <div className="mega-menu__layout mega-menu__layout--simple">
      <MenuHeading eyebrow="05 / RESOURCES" title={title} description={locale === "zh" ? "为项目团队准备的清晰、可靠信息。" : "Clear, dependable information for teams moving projects forward."} />
      <div className="mega-menu__simple-grid">{items.map((item, index) => <MenuLink item={item} key={localized(item.label, locale)} locale={locale} className="mega-menu__simple-link" prefix={<span className="mega-menu__simple-index">0{index + 1}</span>} />)}</div>
      <LocaleLink className="mega-menu__all-link" href={items[0]?.href ?? "/"} locale={locale}>{action}<Arrow /></LocaleLink>
    </div>
  );
}
