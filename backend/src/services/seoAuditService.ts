import {
  seoAuditSchema,
  seoAuditRequestSchema,
  type SeoAudit,
  type SeoAuditCheck,
  type SeoAuditRequest,
} from "@maglive/contracts";
import * as cheerio from "cheerio";
import { Types } from "mongoose";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { CategoryModel } from "../models/Category.js";
import { ProductModel } from "../models/Product.js";
import { SeoAuditModel } from "../models/SeoAudit.js";

const maxHtmlBytes = 2 * 1024 * 1024;
const maxBrokenLinkChecks = 20;

function check(key: string, status: SeoAuditCheck["status"], message: string, value?: string): SeoAuditCheck {
  return { key, status, message, ...(value === undefined ? {} : { value }) };
}

function auditScore(checks: readonly SeoAuditCheck[], brokenLinks: readonly string[]): number {
  let score = 100;
  for (const item of checks) {
    if (item.status === "critical") score -= 15;
    else if (item.status === "recommendation") score -= 5;
  }
  score -= Math.min(20, brokenLinks.length * 5);
  return Math.max(0, Math.min(100, score));
}

function originFor(config: AppConfig): URL {
  try {
    return new URL(config.frontendOrigin);
  } catch {
    throw new AppError(500, "SEO_SITE_URL_INVALID", "The public site origin is not configured correctly.");
  }
}

async function resolveUrl(input: SeoAuditRequest, config: AppConfig): Promise<string> {
  if (!new Types.ObjectId(input.entityId).toString()) {
    throw new AppError(404, "SEO_ENTITY_NOT_FOUND", "The content entity was not found.");
  }
  const origin = originFor(config);
  if (input.contentType === "product") {
    const product = await ProductModel.findOne({ _id: input.entityId, status: "published" });
    const snapshot = product?.publishedSnapshots.get(input.locale);
    const global = product?.publishedGlobal;
    if (product === null || product === undefined || snapshot === undefined || global === undefined || snapshot.globalRevision !== global.globalRevision) {
      throw new AppError(404, "SEO_ENTITY_NOT_FOUND", "The published content entity was not found in this language.");
    }
    const category = await CategoryModel.findById(global.data.categoryId);
    const categorySnapshot = category?.publishedSnapshots.get(input.locale);
    if (category === null || category === undefined || categorySnapshot === undefined || category.publishedGlobal === undefined || categorySnapshot.globalRevision !== category.publishedGlobal.globalRevision) {
      throw new AppError(404, "SEO_ENTITY_NOT_FOUND", "The product category is not publicly visible in this language.");
    }
    return new URL(`/${input.locale}/products/${category.publishedGlobal.data.slug}/${global.data.slug}`, origin).toString();
  }
  if (input.contentType === "category") {
    const category = await CategoryModel.findOne({ _id: input.entityId, status: "active" });
    const snapshot = category?.publishedSnapshots.get(input.locale);
    if (category === null || category === undefined || snapshot === undefined || category.publishedGlobal === undefined || snapshot.globalRevision !== category.publishedGlobal.globalRevision) {
      throw new AppError(404, "SEO_ENTITY_NOT_FOUND", "The published content entity was not found in this language.");
    }
    return new URL(`/${input.locale}/products/category/${category.publishedGlobal.data.slug}`, origin).toString();
  }
  throw new AppError(422, "SEO_ENTITY_UNSUPPORTED", "Rendered audits are currently available for Products and Categories.");
}

async function readHtml(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > maxHtmlBytes) throw new Error("The rendered page is too large to audit.");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > maxHtmlBytes) throw new Error("The rendered page is too large to audit.");
  return text;
}

async function requestStatus(url: string): Promise<number> {
  try {
    const head = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(4_000) });
    if (head.status !== 405 && head.status !== 501) return head.status;
    const get = await fetch(url, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(4_000) });
    return get.status;
  } catch {
    return 599;
  }
}

function serializeAudit(record: SeoAuditRecordLike): SeoAudit {
  return seoAuditSchema.parse({
    id: record.id,
    contentType: record.contentType,
    entityId: record.entityId,
    locale: record.locale,
    url: record.url,
    ...(record.finalUrl === undefined ? {} : { finalUrl: record.finalUrl }),
    httpStatus: record.httpStatus,
    score: record.score,
    checks: record.checks,
    brokenLinks: record.brokenLinks,
    ...(record.error === undefined ? {} : { error: record.error }),
    createdAt: record.createdAt,
  });
}

type SeoAuditRecordLike = {
  id: string;
  contentType: SeoAudit["contentType"];
  entityId: string;
  locale: string;
  url: string;
  finalUrl?: string;
  httpStatus: number;
  score: number;
  checks: SeoAuditCheck[];
  brokenLinks: string[];
  error?: string;
  createdAt: string;
};

export async function runSeoAudit(input: SeoAuditRequest, config: AppConfig): Promise<SeoAudit> {
  const parsedInput = seoAuditRequestSchema.parse(input);
  const url = await resolveUrl(parsedInput, config);
  const origin = originFor(config);
  const checks: SeoAuditCheck[] = [];
  let httpStatus = 599;
  let finalUrl: string | undefined;
  let error: string | undefined;
  let brokenLinks: string[] = [];

  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { Accept: "text/html", "User-Agent": "Maglive-SEO-Audit/1.0" },
      signal: AbortSignal.timeout(10_000),
    });
    httpStatus = response.status;
    finalUrl = response.url || url;
    if (new URL(finalUrl).origin !== origin.origin) throw new Error("The public page redirected outside the configured site origin.");
    const html = await readHtml(response);
    const $ = cheerio.load(html);
    const title = $("title").first().text().trim();
    const description = $("meta[name='description']").attr("content")?.trim() ?? "";
    const canonical = $("link[rel='canonical']").attr("href")?.trim();
    const robots = [$("meta[name='robots']").attr("content"), response.headers.get("x-robots-tag")].filter((value): value is string => value !== null && value !== undefined).join(", ").trim();
    const lang = $("html").attr("lang")?.trim() ?? "";
    const h1s = $("h1").toArray();
    const images = $("img").toArray();
    const hreflang = $("link[rel='alternate'][hreflang]").map((_index, element) => $(element).attr("hreflang") ?? "").get();
    let invalidJsonLd = false;
    const jsonLdTypes = $("script[type='application/ld+json']").map((_index, element) => {
      try {
        const value: unknown = JSON.parse($(element).text());
        if (typeof value === "object" && value !== null && "@type" in value && typeof value["@type"] === "string") return value["@type"];
      } catch { invalidJsonLd = true; }
      return "";
    }).get().filter(Boolean);

    checks.push(httpStatus >= 200 && httpStatus < 400 ? check("http.status", "passed", "The rendered page returned a successful HTTP status.", String(httpStatus)) : check("http.status", "critical", `The rendered page returned HTTP ${httpStatus}.`, String(httpStatus)));
    checks.push(title === "" ? check("head.title", "critical", "The rendered page has no title.") : check("head.title", "passed", "The rendered page has a title.", title));
    checks.push(description === "" ? check("head.description", "critical", "The rendered page has no meta description.") : check("head.description", "passed", "The rendered page has a meta description."));
    if (canonical === undefined) checks.push(check("head.canonical", "critical", "The rendered page has no canonical link."));
    else {
      try {
        const canonicalUrl = new URL(canonical, finalUrl ?? url);
        checks.push(canonicalUrl.origin === origin.origin ? check("head.canonical", "passed", "The rendered page has an on-site canonical link.", canonicalUrl.toString()) : check("head.canonical", "recommendation", "The rendered canonical points outside the configured site origin.", canonicalUrl.toString()));
      } catch { checks.push(check("head.canonical", "critical", "The rendered canonical URL is invalid.", canonical)); }
    }
    checks.push(lang === "" ? check("html.lang", "recommendation", "Set the HTML lang attribute.") : check("html.lang", "passed", "The HTML lang attribute is present.", lang));
    checks.push(h1s.length === 1 ? check("content.h1", "passed", "The rendered page has one H1 heading.") : check("content.h1", "critical", `The rendered page has ${h1s.length} H1 headings.`));
    checks.push(images.every((image) => $(image).attr("alt")?.trim() !== "") ? check("content.image-alt", "passed", "All rendered images have ALT text.") : check("content.image-alt", "recommendation", "One or more rendered images are missing ALT text."));
    checks.push(hreflang.length > 0 ? check("head.hreflang", "passed", "The rendered page exposes language alternates.", hreflang.join(", ")) : check("head.hreflang", "recommendation", "No hreflang alternates were found."));
    const ogTitle = $("meta[property='og:title']").attr("content")?.trim();
    const ogDescription = $("meta[property='og:description']").attr("content")?.trim();
    const ogImage = $("meta[property='og:image']").attr("content")?.trim();
    checks.push(ogTitle ? check("social.open-graph.title", "passed", "Open Graph title is present.") : check("social.open-graph.title", "recommendation", "Open Graph title is missing."));
    checks.push(ogDescription ? check("social.open-graph.description", "passed", "Open Graph description is present.") : check("social.open-graph.description", "recommendation", "Open Graph description is missing."));
    checks.push(ogImage ? check("social.open-graph.image", "passed", "Open Graph image is present.", ogImage) : check("social.open-graph.image", "recommendation", "Open Graph image is missing."));
    checks.push(jsonLdTypes.length > 0 && !invalidJsonLd ? check("schema.json-ld", "passed", "JSON-LD structured data is present.", jsonLdTypes.join(", ")) : check("schema.json-ld", "recommendation", invalidJsonLd ? "One or more JSON-LD blocks are invalid." : "No JSON-LD structured data was found."));
    checks.push(robots.toLowerCase().includes("noindex") ? check("indexability.robots", "recommendation", "The rendered page is noindex.", robots) : check("indexability.robots", "passed", "The rendered page is indexable."));

    const links = new Set<string>();
    $("a[href]").each((_index, element) => {
      try {
        const candidate = new URL($(element).attr("href") ?? "", finalUrl ?? url);
        if (candidate.origin === origin.origin && ["http:", "https:"].includes(candidate.protocol)) links.add(candidate.toString());
      } catch { /* Ignore malformed or non-HTTP links in the crawl sample. */ }
    });
    const candidates = [...links].filter((candidate) => candidate !== finalUrl).slice(0, maxBrokenLinkChecks);
    const statuses = await Promise.all(candidates.map(async (candidate) => ({ candidate, status: await requestStatus(candidate) })));
    brokenLinks = statuses.filter(({ status }) => status >= 400 || status === 599).map(({ candidate }) => candidate);
    checks.push(brokenLinks.length === 0 ? check("links.broken", "passed", "The sampled internal links responded successfully.") : check("links.broken", "recommendation", `${brokenLinks.length} sampled internal link${brokenLinks.length === 1 ? " is" : "s are"} broken.`));
  } catch (reason) {
    error = reason instanceof Error ? reason.message : "The rendered page could not be audited.";
    checks.push(check("audit.request", "critical", error));
  }

  const createdAt = new Date();
  const saved = await SeoAuditModel.create({
    contentType: parsedInput.contentType,
    entityId: new Types.ObjectId(parsedInput.entityId),
    locale: parsedInput.locale,
    url,
    ...(finalUrl === undefined ? {} : { finalUrl }),
    httpStatus,
    score: auditScore(checks, brokenLinks),
    checks,
    brokenLinks,
    ...(error === undefined ? {} : { error }),
    createdAt,
  });
  return serializeAudit({
    id: saved._id.toString(),
    contentType: parsedInput.contentType,
    entityId: parsedInput.entityId,
    locale: parsedInput.locale,
    url,
    ...(finalUrl === undefined ? {} : { finalUrl }),
    httpStatus,
    score: saved.score,
    checks,
    brokenLinks,
    ...(error === undefined ? {} : { error }),
    createdAt: createdAt.toISOString(),
  });
}

export async function getLatestSeoAudit(input: SeoAuditRequest): Promise<SeoAudit | undefined> {
  const record = await SeoAuditModel.findOne({ contentType: input.contentType, entityId: new Types.ObjectId(input.entityId), locale: input.locale }).sort({ createdAt: -1 });
  if (record === null) return undefined;
  return serializeAudit({
    id: record._id.toString(),
    contentType: input.contentType,
    entityId: input.entityId,
    locale: input.locale,
    url: record.url,
    ...(record.finalUrl === undefined ? {} : { finalUrl: record.finalUrl }),
    httpStatus: record.httpStatus,
    score: record.score,
    checks: record.checks,
    brokenLinks: record.brokenLinks,
    ...(record.error === undefined ? {} : { error: record.error }),
    createdAt: record.createdAt.toISOString(),
  });
}
