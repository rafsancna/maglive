import type { LanguageDto, LocaleCode, PublicProductDetailDto, PublicCategoryDto } from "@maglive/contracts";

export const siteUrl = new URL(process.env.SITE_URL ?? "http://localhost:3000");

export function localizedPath(locale: LocaleCode, path: string): string {
  return new URL(`/${locale}${path.startsWith("/") ? path : `/${path}`}`, siteUrl).toString();
}

function languageTag(locale: LocaleCode, languages: readonly LanguageDto[]): string {
  return languages.find((language) => language.code === locale)?.languageTag ?? locale;
}

export function productMetadata(product: PublicProductDetailDto, locale: LocaleCode, languages: readonly LanguageDto[]) {
  const title = product.seo.title || product.name;
  const description = product.seo.description || product.shortDescription;
  const alternates: Record<string, string> = {};
  for (const available of product.availableLocales) alternates[languageTag(available, languages)] = localizedPath(available, `/products/${product.slug}`);
  alternates["x-default"] = localizedPath("en", `/products/${product.slug}`);
  return { title, description, alternates: { canonical: localizedPath(locale, `/products/${product.slug}`), languages: alternates }, openGraph: { type: "website" as const, title, description, url: localizedPath(locale, `/products/${product.slug}`), locale: languageTag(locale, languages), ...(product.seo.openGraphMedia ? { images: [{ url: product.seo.openGraphMedia.url, width: product.seo.openGraphMedia.width, height: product.seo.openGraphMedia.height, alt: title }] } : {}) }, ...(product.seo.openGraphMedia ? { twitter: { card: "summary_large_image" as const, title, description, images: [product.seo.openGraphMedia.url] } } : {}) };
}

export function categoryMetadata(category: PublicCategoryDto, locale: LocaleCode, languageDefinitions: readonly LanguageDto[]) {
  const title = category.seo.title || category.name;
  const description = category.seo.description || category.description;
  const languages: Record<string, string> = {};
  for (const available of category.availableLocales) languages[languageTag(available, languageDefinitions)] = localizedPath(available, `/products/category/${category.slug}`);
  languages["x-default"] = localizedPath("en", `/products/category/${category.slug}`);
  return { title, ...(description ? { description } : {}), alternates: { canonical: localizedPath(locale, `/products/category/${category.slug}`), languages }, openGraph: { type: "website" as const, title, ...(description ? { description } : {}), url: localizedPath(locale, `/products/category/${category.slug}`) } };
}
