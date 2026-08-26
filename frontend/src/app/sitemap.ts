import type { MetadataRoute } from "next";
import { LOCALE_CODES, LOCALE_REGISTRY } from "@maglive/contracts";
import { getSitemapEntries } from "@/lib/public-api";
import { localizedPath } from "@/lib/seo";

const corporatePaths = ["/", "/about", "/products", "/projects", "/news", "/downloads", "/contact"] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];
  for (const locale of LOCALE_CODES) {
    for (const path of corporatePaths) entries.push({ url: localizedPath(locale, path), alternates: { languages: Object.fromEntries(LOCALE_CODES.map((code) => [LOCALE_REGISTRY[code].languageTag, localizedPath(code, path)])) } });
  }
  try {
    const first = await getSitemapEntries(1, 100);
    const pages = [first, ...await Promise.all(Array.from({ length: Math.max(0, first.pagination.totalPages - 1) }, (_, index) => getSitemapEntries(index + 2, 100)))];
    for (const page of pages) for (const item of page.items) entries.push({ url: new URL(item.path, process.env.SITE_URL ?? "http://localhost:3000").toString(), lastModified: item.updatedAt });
  } catch {
    // Corporate routes remain available when the catalog API is offline.
  }
  return entries;
}

