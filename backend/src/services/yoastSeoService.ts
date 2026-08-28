import { createRequire } from "node:module";
import type { SeoDocumentInput, SeoIssue } from "@maglive/contracts";

type YoastResult = {
  getIdentifier?: () => string;
  getScore?: () => number;
  getText?: () => string;
};

type YoastAssessor = {
  assess: (paper: unknown) => void;
  calculateOverallScore: () => number;
  getValidResults: () => YoastResult[];
};

type YoastEngine = {
  Paper: new (text: string, attributes: Record<string, unknown>) => unknown;
  Researcher: new (paper: unknown) => unknown;
  SeoAssessor: new (researcher: unknown) => YoastAssessor;
};

const require = createRequire(import.meta.url);
const engineCache = new Map<string, YoastEngine | null>();

const localeMap: Readonly<Record<string, string>> = {
  en: "en_US",
  de: "de_DE",
  nl: "nl_NL",
  fr: "fr_FR",
  es: "es_ES",
  it: "it_IT",
  pt: "pt_PT",
  ru: "ru_RU",
  pl: "pl_PL",
  sv: "sv_SE",
  hu: "hu_HU",
  id: "id_ID",
  ar: "ar",
  he: "he_IL",
  fa: "fa_IR",
  tr: "tr_TR",
  nb: "nb_NO",
  cs: "cs_CZ",
  sk: "sk_SK",
  el: "el_GR",
  ja: "ja",
};

function getEngine(language: string): YoastEngine | undefined {
  const cachedEngine = engineCache.get(language);
  if (cachedEngine !== undefined) return cachedEngine ?? undefined;
  try {
    const packageExports = require("yoastseo") as {
      Paper?: YoastEngine["Paper"];
      SeoAssessor?: YoastEngine["SeoAssessor"];
    };
    const researcherModule = require(
      `yoastseo/build/languageProcessing/languages/${language}/Researcher`,
    ) as { default?: YoastEngine["Researcher"] };
    if (
      packageExports.Paper === undefined ||
      packageExports.SeoAssessor === undefined ||
      researcherModule.default === undefined
    ) {
      engineCache.set(language, null);
      return undefined;
    }
    const engine = {
      Paper: packageExports.Paper,
      SeoAssessor: packageExports.SeoAssessor,
      Researcher: researcherModule.default,
    };
    engineCache.set(language, engine);
    return engine;
  } catch {
    engineCache.set(language, null);
    return undefined;
  }
}

function stripMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function escapeMarkup(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function yoastLocale(input: SeoDocumentInput): string | undefined {
  const languagePart = input.languageTag?.split("-")[0];
  const candidate = (languagePart ?? input.locale).toLowerCase();
  return localeMap[candidate];
}

export function isYoastLocaleSupported(input: SeoDocumentInput): boolean {
  return yoastLocale(input) !== undefined && getEngine(yoastLocale(input)?.split("_")[0] ?? "en") !== undefined;
}

export type YoastAnalysis = Readonly<{
  supported: boolean;
  score?: number;
  issues: SeoIssue[];
}>;

export function analyzeWithYoast(input: SeoDocumentInput): YoastAnalysis {
  const locale = yoastLocale(input);
  if (locale === undefined) return { supported: false, issues: [] };
  const engine = getEngine(locale.split("_")[0] ?? "en");
  if (engine === undefined) {
    return { supported: false, issues: [] };
  }

  const headings = input.headings
    .map((heading, index) => `<h${index === 0 ? "1" : "2"}>${escapeMarkup(heading)}</h${index === 0 ? "1" : "2"}>`)
    .join("");
  const images = input.images
    .map((image) => `<img alt="${escapeMarkup(image.alt ?? "")}">`)
    .join("");
  const paper = new engine.Paper(`${headings}${images}${input.content}`, {
    keyword: input.focusKeyphrase,
    description: input.description,
    title: input.title,
    slug: input.slug,
    locale,
    permalink: input.canonicalUrl ?? "",
  });
  const researcher = new engine.Researcher(paper);
  const assessor = new engine.SeoAssessor(researcher);
  assessor.assess(paper);
  const issues = assessor
    .getValidResults()
    .map((result, index) => {
      const resultScore = result.getScore?.() ?? 0;
      const status: SeoIssue["status"] = resultScore >= 7 ? "passed" : resultScore >= 4 ? "recommendation" : "critical";
      const identifier = result.getIdentifier?.() ?? `assessment-${index + 1}`;
      const text = stripMarkup(result.getText?.() ?? "Yoast assessment completed.").trim();
      return {
        key: `yoast.${identifier}`,
        status,
        message: text || `Yoast assessment ${identifier} completed.`,
        points: Math.max(-10, Math.min(10, resultScore - 5)),
        source: "yoast" as const,
      };
    });
  return {
    supported: true,
    score: Math.max(0, Math.min(100, Math.round(assessor.calculateOverallScore()))),
    issues,
  };
}
