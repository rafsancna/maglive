import type { ReactNode } from "react";
import type { LocaleCode, PublicCategoryDto, PublicProductDetailDto } from "@maglive/contracts";
import { siteUrl, localizedPath } from "./seo";
import { productPath } from "./product-path";

export function JsonLd({ value }: { value: unknown }) {
  const serialized = JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialized }} />;
}

export function organizationJsonLd() {
  return { "@context": "https://schema.org", "@type": "Organization", name: "Maglive", url: siteUrl.toString() };
}

export function productJsonLd(product: PublicProductDetailDto, locale: LocaleCode) {
  return { "@context": "https://schema.org", "@type": "Product", name: product.name, description: product.shortDescription, url: localizedPath(locale, productPath(product)), ...(product.model ? { model: product.model } : {}), category: product.category.name, brand: { "@type": "Brand", name: "Maglive" }, ...(product.media.filter((item) => item.kind === "image").length > 0 ? { image: product.media.filter((item) => item.kind === "image").map((item) => item.url) } : {}) };
}

export function breadcrumbJsonLd(product: PublicProductDetailDto, locale: LocaleCode) {
  const items = [{ name: "Products", url: localizedPath(locale, "/products") }, ...product.category.breadcrumbs.map((item) => ({ name: item.name, url: localizedPath(locale, `/products/category/${item.slug}`) })), { name: product.name, url: localizedPath(locale, productPath(product)) }];
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })) };
}

export function categoryJsonLd(category: PublicCategoryDto, locale: LocaleCode) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: category.name,
    ...(category.description === undefined ? {} : { description: category.description }),
    url: localizedPath(locale, `/products/category/${category.slug}`),
  };
}

export function categoryBreadcrumbJsonLd(category: PublicCategoryDto, locale: LocaleCode) {
  const items = [
    { name: "Products", url: localizedPath(locale, "/products") },
    ...category.breadcrumbs.map((item) => ({ name: item.name, url: localizedPath(locale, `/products/category/${item.slug}`) })),
  ];
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item.name, item: item.url })) };
}

export function StructuredData({ product, locale }: { product: PublicProductDetailDto; locale: LocaleCode }): ReactNode {
  return <><JsonLd value={organizationJsonLd()} /><JsonLd value={breadcrumbJsonLd(product, locale)} /><JsonLd value={productJsonLd(product, locale)} /></>;
}

export function CategoryStructuredData({ category, locale }: { category: PublicCategoryDto; locale: LocaleCode }): ReactNode {
  return <><JsonLd value={organizationJsonLd()} /><JsonLd value={categoryBreadcrumbJsonLd(category, locale)} /><JsonLd value={categoryJsonLd(category, locale)} /></>;
}
