import type { MetadataRoute } from "next";
import { getSitemapEntries } from "@/lib/public-api";
import { localizedPath } from "@/lib/seo";
import { getAvailableLanguages } from "@/i18n/languages";

const corporatePaths = ["/", "/about", "/products", "/projects", "/news", "/downloads", "/contact"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  const languages = await getAvailableLanguages();
  for (const { code: locale } of languages) {
    for (const path of corporatePaths) entries.push({ url: localizedPath(locale, path), alternates: { languages: Object.fromEntries(languages.map((language) => [language.languageTag, localizedPath(language.code, path)])) } });
  }
  try {
    const first = await getSitemapEntries(1, 100);
    const pages = [first, ...await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_, index) => getSitemapEntries(index + 2, 100)))];
    for (const page of pages) for (const item of page.items) {
      const path = item.path.replace(/^\/[^/]+/, "") || "/";
      entries.push({
        url: new URL(item.path, process.env.SITE_URL ?? "http://localhost:3000").toString(),
        lastModified: item.updatedAt,
        alternates: { languages: Object.fromEntries(item.availableLocales.map((available) => [languages.find((language) => language.code === available)?.languageTag ?? available, localizedPath(available, path)])) },
      });
    }
  } catch {
    // Corporate routes remain available when the catalog API is offline.
  }
  return entries;
}
