import {
  publicCategoryDtoSchema,
  publicCategoryTreeDtoSchema,
  publicProductDetailDtoSchema,
  publicProductListDtoSchema,
  publicProductVisibilityDtoSchema,
  navigationDataSchema,
  publicSitemapEntriesDtoSchema,
  languageListDtoSchema,
  type PublicCategoryDto,
  type PublicCategoryTreeDto,
  type PublicProductDetailDto,
  type PublicProductListDto,
  type PublicProductListQuery,
  type PublicProductVisibilityDto,
  type PublicSitemapEntriesDto,
  type LanguageListDto,
  type NavigationData,
  publicNewsDetailDtoSchema,
  publicNewsListDtoSchema,
  type PublicNewsDetailDto,
  type PublicNewsListDto,
  type PublicNewsListQuery,
  publicSiteSettingsDtoSchema,
  type PublicSiteSettingsDto,
} from "@maglive/contracts";
import type { z } from "zod";
import { apiOrigin, normalizeMediaUrlFields } from "@/lib/media-origin";

const baseUrl = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1").replace(/\/$/, "");

export class PublicApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = "PublicApiError";
  }
}

/**
 * Re-points every media link returned by the API at the origin of this
 * deployment, so a catalog cached or seeded against another host (localhost, an
 * IP address, a staging domain, a CDN) still renders correctly. Anything that is
 * not a trusted http(s) URL is rejected, exactly as before.
 */
function assertSafeMediaUrls(value: unknown): void {
  if (normalizeMediaUrlFields(value).length > 0) {
    throw new PublicApiError(502, "INVALID_MEDIA_URL", "The catalog returned an unsafe media URL.");
  }
}

async function request<TSchema extends z.ZodType>(path: string, schema: TSchema): Promise<z.infer<TSchema>> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        // Tells the API which origin browsers use, so the media and flag links
        // it builds are valid on whatever host, IP address or domain is serving
        // this deployment.
        "X-Public-Origin": apiOrigin(),
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new PublicApiError(503, "API_UNAVAILABLE", "The catalog service is unavailable.");
  }
  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null && "error" in payload ? (payload as { error?: { code?: string; message?: string } }).error : undefined;
    throw new PublicApiError(response.status, error?.code ?? "API_ERROR", error?.message ?? "The catalog request failed.");
  }
  const data = typeof payload === "object" && payload !== null && "data" in payload ? payload.data : undefined;
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new PublicApiError(502, "INVALID_API_RESPONSE", "The catalog response is invalid.");
  assertSafeMediaUrls(parsed.data);
  return parsed.data;
}

export function listPublicProducts(query: PublicProductListQuery): Promise<PublicProductListDto> {
  const parameters = new URLSearchParams({ page: String(query.page), limit: String(query.limit), locale: query.locale, sort: query.sort });
  if (query.category !== undefined) parameters.set("category", query.category);
  if (query.featured !== undefined) parameters.set("featured", String(query.featured));
  return request(`/public/products?${parameters.toString()}`, publicProductListDtoSchema);
}

export function getPublicProductVisibility(slug: string, locale: string): Promise<PublicProductVisibilityDto> {
  return request(`/public/products/${encodeURIComponent(slug)}/visibility?locale=${encodeURIComponent(locale)}`, publicProductVisibilityDtoSchema);
}

export function getPublicProduct(slug: string, locale: string, publicationRevision: string): Promise<PublicProductDetailDto> {
  return request(`/public/products/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}&publicationRevision=${encodeURIComponent(publicationRevision)}`, publicProductDetailDtoSchema);
}

export async function getPublicProductWithVisibility(slug: string, locale: string): Promise<PublicProductDetailDto> {
  let visibility = await getPublicProductVisibility(slug, locale);
  try {
    return await getPublicProduct(slug, locale, visibility.publicationRevision);
  } catch (error) {
    if (!(error instanceof PublicApiError) || error.code !== "PUBLICATION_REVISION_CHANGED") throw error;
    visibility = await getPublicProductVisibility(slug, locale);
    try { return await getPublicProduct(slug, locale, visibility.publicationRevision); } catch { throw new PublicApiError(503, "PUBLICATION_RACE", "The published product changed while loading. Retry shortly."); }
  }
}

export function getPublicCategoryTree(locale: string): Promise<PublicCategoryTreeDto> {
  return request(`/public/categories?locale=${encodeURIComponent(locale)}`, publicCategoryTreeDtoSchema);
}

export function getPublicCategory(slug: string, locale: string): Promise<PublicCategoryDto> {
  return request(`/public/categories/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`, publicCategoryDtoSchema);
}

export function getSitemapEntries(page: number, limit = 100): Promise<PublicSitemapEntriesDto> {
  return request(`/public/sitemap-entries?page=${page}&limit=${limit}`, publicSitemapEntriesDtoSchema);
}

export function getPublicLanguages(): Promise<LanguageListDto> {
  return request("/public/languages", languageListDtoSchema);
}

export function getPublicNavigation(locale: string): Promise<NavigationData> {
  return request(`/public/navigation?locale=${encodeURIComponent(locale)}`, navigationDataSchema);
}

export function getPublicSiteSettings(): Promise<PublicSiteSettingsDto> {
  return request("/public/site-settings", publicSiteSettingsDtoSchema);
}

export function listPublicNews(query: PublicNewsListQuery): Promise<PublicNewsListDto> {
  const parameters = new URLSearchParams({ page: String(query.page), limit: String(query.limit), locale: query.locale });
  if (query.category !== undefined) parameters.set("category", query.category);
  if (query.tag !== undefined) parameters.set("tag", query.tag);
  if (query.search !== undefined) parameters.set("search", query.search);
  if (query.featured !== undefined) parameters.set("featured", String(query.featured));
  return request(`/public/news?${parameters}`, publicNewsListDtoSchema);
}

export function getPublicNews(slug: string, locale: string): Promise<PublicNewsDetailDto> {
  return request(`/public/news/${encodeURIComponent(slug)}?locale=${encodeURIComponent(locale)}`, publicNewsDetailDtoSchema);
}
