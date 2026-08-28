import {
  seoDocumentInputSchema,
  seoScoreSchema,
  type SeoDocumentInput,
  type SeoIssue,
  type SeoScore,
} from "@maglive/contracts";
import { analyzeWithYoast, isYoastLocaleSupported } from "./yoastSeoService.js";

function issue(
  key: string,
  status: SeoIssue["status"],
  message: string,
  points: number,
): SeoIssue {
  return { key, status, message, points };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function hasPhrase(haystack: string, phrase: string): boolean {
  const needle = normalized(phrase);
  return needle !== "" && normalized(haystack).includes(needle);
}

function scoreDocument(input: SeoDocumentInput, calculatedAt = new Date()): SeoScore {
  const issues: SeoIssue[] = [];
  let score = 0;
  const titleLength = [...input.title.trim()].length;
  const descriptionLength = [...input.description.trim()].length;

  if (titleLength === 0) {
    issues.push(issue("title.missing", "critical", "SEO title is missing.", 0));
  } else if (titleLength < 30 || titleLength > 60) {
    score += 10;
    issues.push(issue("title.length", "recommendation", "Keep the SEO title between 30 and 60 characters where possible.", 10));
  } else {
    score += 15;
    issues.push(issue("title.exists", "passed", "SEO title exists and is a useful length.", 15));
  }

  if (descriptionLength === 0) {
    issues.push(issue("description.missing", "critical", "Meta description is missing.", 0));
  } else if (descriptionLength < 120 || descriptionLength > 160) {
    score += 10;
    issues.push(issue("description.length", "recommendation", "Keep the meta description close to 120-160 characters.", 10));
  } else {
    score += 15;
    issues.push(issue("description.exists", "passed", "Meta description exists and is a useful length.", 15));
  }

  if (input.focusKeyphrase.trim() === "") {
    issues.push(issue("keyphrase.missing", "recommendation", "Add a focus keyphrase for this language.", 0));
  } else {
    score += 5;
    const phraseLocations = [input.title, input.description, input.content, ...input.headings];
    if (phraseLocations.some((value) => hasPhrase(value, input.focusKeyphrase))) {
      score += 10;
      issues.push(issue("keyphrase.used", "passed", "The focus keyphrase appears in the page content.", 15));
    } else {
      issues.push(issue("keyphrase.unused", "recommendation", "Use the focus keyphrase in the title, description, heading, or content.", 5));
    }
  }

  if (input.slug.trim() !== "") {
    score += 5;
    issues.push(issue("slug.exists", "passed", "A canonical slug is present.", 5));
  } else {
    issues.push(issue("slug.missing", "critical", "A public slug is missing.", 0));
  }

  if (input.headings.some((heading) => /^h1\b/i.test(heading))) {
    score += 5;
    issues.push(issue("headings.h1", "passed", "An H1 heading is present.", 5));
  } else if (input.headings.length > 0) {
    issues.push(issue("headings.h1", "critical", "Add one visible H1 heading.", 0));
  } else {
    issues.push(issue("headings.missing", "recommendation", "Add headings that describe the page structure.", 0));
  }
  if (input.headings.length >= 2) {
    score += 5;
    issues.push(issue("headings.structure", "passed", "The page contains multiple headings for scanability.", 5));
  } else {
    issues.push(issue("headings.structure", "recommendation", "Add supporting headings where the content warrants them.", 0));
  }

  const missingAlt = input.images.filter((image) => image.alt?.trim() === "").length;
  if (input.images.length === 0) {
    score += 5;
    issues.push(issue("images.none", "recommendation", "No images are present to assess.", 5));
  } else if (missingAlt === 0) {
    score += 10;
    issues.push(issue("images.alt", "passed", "All page images have alternative text.", 10));
  } else {
    issues.push(issue("images.alt", "recommendation", `${missingAlt} image${missingAlt === 1 ? " is" : "s are"} missing ALT text.`, 0));
  }

  if (input.internalLinks >= 2) {
    score += 5;
    issues.push(issue("links.internal", "passed", "The page contains useful internal links.", 5));
  } else {
    issues.push(issue("links.internal", "recommendation", "Add relevant internal links where available.", 0));
  }

  if (input.canonicalUrl !== undefined) {
    try {
      const canonical = new URL(input.canonicalUrl);
      if (canonical.protocol === "https:" || canonical.protocol === "http:") {
        score += 10;
        issues.push(issue("canonical.valid", "passed", "Canonical URL is an absolute HTTP(S) URL.", 10));
      } else {
        issues.push(issue("canonical.invalid", "critical", "Canonical URL must use HTTP or HTTPS.", 0));
      }
    } catch {
      issues.push(issue("canonical.invalid", "critical", "Canonical URL is invalid.", 0));
    }
  } else {
    issues.push(issue("canonical.missing", "recommendation", "Add or confirm the self-referencing canonical URL.", 0));
  }

  if (input.robots.index === true && input.robots.follow === true) {
    score += 5;
    issues.push(issue("indexability.enabled", "passed", "The page is configured for indexing and link following.", 5));
  } else {
    issues.push(issue("indexability.disabled", "recommendation", "This page is configured as noindex or nofollow.", 0));
  }

  const missingHreflang = input.publishedLocales.filter((locale) => !input.hreflangLocales.includes(locale));
  if (input.publishedLocales.length > 0 && missingHreflang.length === 0) {
    score += 5;
    issues.push(issue("hreflang.complete", "passed", "Published translations have hreflang entries.", 5));
  } else if (missingHreflang.length > 0) {
    issues.push(issue("hreflang.missing", "critical", `${missingHreflang.length} published translation${missingHreflang.length === 1 ? " is" : "s are"} missing hreflang.`, 0));
  } else {
    issues.push(issue("hreflang.pending", "recommendation", "Publish translations before evaluating hreflang coverage.", 0));
  }

  if (input.expectedSchema === undefined || input.hasStructuredData) {
    score += 5;
    issues.push(issue("schema.present", "passed", "Structured data is present or not required for this draft.", 5));
  } else {
    issues.push(issue("schema.missing", "recommendation", `Add truthful ${input.expectedSchema} structured data.`, 0));
  }

  const missingTranslations = input.availableLocales.filter((locale) => !input.publishedLocales.includes(locale));
  if (missingTranslations.length === 0 && input.availableLocales.length > 0) {
    score += 5;
    issues.push(issue("translations.complete", "passed", "All configured locales are published for this entity.", 5));
  } else if (missingTranslations.length > 0) {
    issues.push(issue("translations.missing", "recommendation", `${missingTranslations.length} configured translation${missingTranslations.length === 1 ? " is" : "s are"} not published.`, 0));
  } else {
    issues.push(issue("translations.pending", "recommendation", "Add the configured locale set before publishing.", 0));
  }

  const yoast = analyzeWithYoast(input);
  const combinedIssues = [...issues, ...yoast.issues];
  const combinedScore = yoast.score === undefined ? score : Math.round(score * 0.7 + yoast.score * 0.3);
  return seoScoreSchema.parse({
    contentType: input.contentType,
    locale: input.locale,
    score: Math.max(0, Math.min(100, combinedScore)),
    issues: combinedIssues,
    calculatedAt: calculatedAt.toISOString(),
  });
}

export function calculateSeoScore(input: SeoDocumentInput): SeoScore {
  return scoreDocument(seoDocumentInputSchema.parse(input));
}

export function seoEngineAvailability(input: SeoDocumentInput): { yoast: boolean; yoastLocaleSupported: boolean } {
  const parsed = seoDocumentInputSchema.parse(input);
  const supported = isYoastLocaleSupported(parsed);
  return { yoast: supported, yoastLocaleSupported: supported };
}
