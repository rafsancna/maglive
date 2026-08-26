import type { LocaleCode, PublicCategoryTreeNode, PublicProductSummaryDto } from "@maglive/contracts";
import { LocaleLink } from "../site/LocaleLink";

export function ProductCard({ product, locale }: { product: PublicProductSummaryDto; locale: LocaleCode }) {
  return <article className="catalog-card"><div className="catalog-card__body"><span className="catalog-card__category">{product.category.name}</span><h2><LocaleLink href={`/products/${product.slug}`} locale={locale}>{product.name}</LocaleLink></h2><p>{product.shortDescription}</p>{product.model ? <small>{product.model}</small> : null}</div><LocaleLink className="text-link" href={`/products/${product.slug}`} locale={locale}>View product</LocaleLink></article>;
}

export function CategoryTree({ nodes, locale }: { nodes: readonly PublicCategoryTreeNode[]; locale: LocaleCode }) {
  return <ul className="catalog-category-tree">{nodes.map((node) => <li key={node.id}><LocaleLink href={`/products/category/${node.slug}`} locale={locale}><strong>{node.name}</strong></LocaleLink>{node.description ? <p>{node.description}</p> : null}{node.children.length > 0 ? <CategoryTree locale={locale} nodes={node.children} /> : null}</li>)}</ul>;
}

export function CategoryLanguageSwitcher({ slug, locale, availableLocales }: { slug: string; locale: LocaleCode; availableLocales: readonly LocaleCode[] }) {
  return <nav aria-label="Category languages" className="product-language-switcher">{availableLocales.map((candidate) => <LocaleLink aria-current={candidate === locale ? "page" : undefined} href={`/products/category/${slug}`} key={candidate} locale={candidate}>{candidate.toUpperCase()}</LocaleLink>)}</nav>;
}
