import {
  type SeoDocumentInput,
  type SeoDashboardSummary,
  seoDashboardSummarySchema,
  type LocaleCode,
  type SearchProvider,
} from "@maglive/contracts";
import { CategoryModel } from "../models/Category.js";
import { ProductModel } from "../models/Product.js";
import { SearchMetricSnapshotModel } from "../models/SearchMetricSnapshot.js";
import { SeoAuditModel } from "../models/SeoAudit.js";
import { calculateSeoScore } from "./seoScoringService.js";

function scoreInput(contentType: "product" | "category", locale: LocaleCode, data: { name: string; description?: string | undefined; seo: { title: string; description?: string; focusKeyphrase?: string; robots?: { index: boolean; follow: boolean } }; slug: string; content?: string; images?: { alt?: string | undefined }[] }, locales: LocaleCode[], publishedLocales: LocaleCode[]): SeoDocumentInput {
  return {
    contentType,
    locale,
    title: data.seo.title || data.name,
    description: data.seo.description || data.description || "",
    focusKeyphrase: data.seo.focusKeyphrase ?? "",
    slug: data.slug,
    content: data.content ?? data.description ?? "",
    headings: ["h1"],
    images: (data.images ?? []).map((image) => image.alt === undefined ? {} : { alt: image.alt }),
    internalLinks: 1,
    robots: data.seo.robots ?? { index: true, follow: true },
    availableLocales: [...locales],
    publishedLocales: [...publishedLocales],
    hreflangLocales: [...publishedLocales],
    expectedSchema: contentType === "product" ? "Product" : "CollectionPage",
    hasStructuredData: true,
  };
}

export async function getSeoDashboardSummary(): Promise<SeoDashboardSummary> {
  const [products, categories, metricRecords, auditRecords] = await Promise.all([
    ProductModel.find({ status: "published", publishedGlobal: { $exists: true } }),
    CategoryModel.find({ status: "active", publishedGlobal: { $exists: true } }),
    SearchMetricSnapshotModel.find().sort({ fetchedAt: -1 }).limit(200),
    SeoAuditModel.find().sort({ createdAt: -1 }).limit(200),
  ]);
  const scoresByType = new Map<string, number[]>();
  let scoreTotal = 0;
  let scoreCount = 0;
  let criticalIssues = 0;
  let missingMetaDescriptions = 0;
  let missingAltText = 0;
  let hreflangProblems = 0;
  let schemaProblems = 0;
  const brokenLinks = auditRecords.reduce((sum, audit) => sum + audit.brokenLinks.length, 0);

  const consume = (contentType: "product" | "category", locale: LocaleCode, input: SeoDocumentInput) => {
    const score = calculateSeoScore(input);
    scoreTotal += score.score;
    scoreCount += 1;
    const values = scoresByType.get(contentType) ?? [];
    values.push(score.score);
    scoresByType.set(contentType, values);
    for (const item of score.issues) {
      if (item.status === "critical") criticalIssues += 1;
      if (item.key.startsWith("description.missing")) missingMetaDescriptions += 1;
      if (item.key === "images.alt" && item.status !== "passed") missingAltText += 1;
      if (item.key.startsWith("hreflang.") && item.status !== "passed") hreflangProblems += 1;
      if (item.key.startsWith("schema.") && item.status !== "passed") schemaProblems += 1;
    }
    void locale;
  };

  for (const product of products) {
    const global = product.publishedGlobal;
    if (global === undefined) continue;
    const publishedLocales = [...product.publishedSnapshots.keys()].filter((value): value is LocaleCode => typeof value === "string");
    for (const [locale, snapshot] of product.publishedSnapshots.entries()) {
      consume("product", locale as LocaleCode, scoreInput("product", locale as LocaleCode, { name: snapshot.data.name, ...(snapshot.data.shortDescription === undefined ? {} : { description: snapshot.data.shortDescription }), seo: snapshot.data.seo, slug: global.data.slug, ...(snapshot.data.longDescriptionMarkdown === undefined ? {} : { content: snapshot.data.longDescriptionMarkdown }), images: snapshot.data.mediaUsages.map((item) => item.alt === undefined ? {} : { alt: item.alt }) }, publishedLocales as LocaleCode[], publishedLocales as LocaleCode[]));
    }
  }
  for (const category of categories) {
    const global = category.publishedGlobal;
    if (global === undefined) continue;
    const publishedLocales = [...category.publishedSnapshots.keys()].filter((value): value is LocaleCode => typeof value === "string");
    for (const [locale, snapshot] of category.publishedSnapshots.entries()) {
      consume("category", locale as LocaleCode, scoreInput("category", locale as LocaleCode, { name: snapshot.data.name, description: snapshot.data.description, seo: snapshot.data.seo, slug: global.data.slug, images: snapshot.data.image === undefined ? [] : [{ alt: snapshot.data.image.alt }] }, publishedLocales as LocaleCode[], publishedLocales as LocaleCode[]));
    }
  }
  const byContentType: Record<string, number> = {};
  for (const [type, values] of scoresByType) byContentType[type] = values.length === 0 ? 0 : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const providers: Partial<Record<SearchProvider, { available: boolean; fetchedAt?: string }>> = {};
  for (const provider of ["google", "bing", "baidu", "yandex"] as const) {
    const metric = metricRecords.find((item) => item.provider === provider);
    providers[provider] = metric === undefined ? { available: false } : { available: true, fetchedAt: metric.fetchedAt.toISOString() };
  }
  return seoDashboardSummarySchema.parse({ averageScore: scoreCount === 0 ? 0 : Math.round(scoreTotal / scoreCount), criticalIssues, missingMetaDescriptions, missingAltText, hreflangProblems, schemaProblems, brokenLinks, byContentType, providers });
}
