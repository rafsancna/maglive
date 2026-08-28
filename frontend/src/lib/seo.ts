import type { LanguageDto, LocaleCode, PublicProductDetailDto, PublicCategoryDto } from "@maglive/contracts";
import { productPath } from "./product-path";

export const siteUrl = new URL(process.env.SITE_URL ?? "http://localhost:3000");

export function localizedPath(locale: LocaleCode, path: string): string {
  return new URL(`/${locale}${path.startsWith("/") ? path : `/${path}`}`, siteUrl).toString();
}

function languageTag(locale: LocaleCode, languages: readonly LanguageDto[]): string {
  return languages.find((language) => language.code === locale)?.languageTag ?? locale;
}

function canonicalUrl(override: string | undefined, fallback: string): string {
  if (override === undefined) return fallback;
  try {
    const candidate = new URL(override);
    if ((candidate.protocol !== "http:" && candidate.protocol !== "https:") || candidate.origin !== siteUrl.origin) return fallback;
    return candidate.toString();
  } catch {
    return fallback;
  }
}

function robotsFor(value: { index: boolean; follow: boolean } | undefined) {
  return value === undefined ? undefined : { index: value.index, follow: value.follow };
}

export function productMetadata(product: PublicProductDetailDto, locale: LocaleCode, languages: readonly LanguageDto[]) {
  const title = product.seo.title || product.name;
  const description = product.seo.description || product.shortDescription;
  const fallbackCanonical = localizedPath(locale, productPath(product));
  const canonical = canonicalUrl(product.seo.canonicalUrlOverride, fallbackCanonical);
  const alternates: Record<string, string> = {};
  for (const available of product.availableLocales) alternates[languageTag(available, languages)] = localizedPath(available, productPath(product));
  alternates["x-default"] = localizedPath("en", productPath(product));
  const openGraphTitle = product.seo.openGraphTitle || title;
  const openGraphDescription = product.seo.openGraphDescription || description;
  return { title, description, alternates: { canonical, languages: alternates }, robots: robotsFor(product.seo.robots), openGraph: { type: "website" as const, title: openGraphTitle, description: openGraphDescription, url: canonical, locale: languageTag(locale, languages), ...(product.seo.openGraphMedia ? { images: [{ url: product.seo.openGraphMedia.url, width: product.seo.openGraphMedia.width, height: product.seo.openGraphMedia.height, alt: openGraphTitle }] } : {}) }, ...(product.seo.openGraphMedia ? { twitter: { card: "summary_large_image" as const, title: openGraphTitle, description: openGraphDescription, images: [product.seo.openGraphMedia.url] } } : {}) };
}

export function categoryMetadata(category: PublicCategoryDto, locale: LocaleCode, languageDefinitions: readonly LanguageDto[]) {
  const title = category.seo.title || category.name;
  const description = category.seo.description || category.description;
  const fallbackCanonical = localizedPath(locale, `/products/category/${category.slug}`);
  const canonical = canonicalUrl(category.seo.canonicalUrlOverride, fallbackCanonical);
  const languages: Record<string, string> = {};
  for (const available of category.availableLocales) languages[languageTag(available, languageDefinitions)] = localizedPath(available, `/products/category/${category.slug}`);
  languages["x-default"] = localizedPath("en", `/products/category/${category.slug}`);
  const openGraphTitle = category.seo.openGraphTitle || title;
  const openGraphDescription = category.seo.openGraphDescription || description;
  return { title, ...(description ? { description } : {}), alternates: { canonical, languages }, robots: robotsFor(category.seo.robots), openGraph: { type: "website" as const, title: openGraphTitle, ...(openGraphDescription ? { description: openGraphDescription } : {}), url: canonical } };
}
