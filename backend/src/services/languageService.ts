import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  getLocaleMetadata,
  type CreateLanguageRequest,
  type LanguageDto,
  type LanguageListDto,
  type LocaleCode,
  type SafeAdminDto,
} from "@maglive/contracts";
import { Types } from "mongoose";
import { AppError } from "../errors/AppError.js";
import { LanguageModel, type Language } from "../models/Language.js";

const builtInLanguages: readonly LanguageDto[] = LOCALE_CODES.map((code) => {
  const metadata = getLocaleMetadata(code);
  return {
    code,
    languageTag: metadata.languageTag,
    acceptLanguageAliases: [...metadata.acceptLanguageAliases],
    direction: metadata.direction,
    fallback: metadata.fallback,
    label: metadata.label,
    nativeLabel: metadata.nativeLabel,
    builtIn: true,
  };
});

function toDto(language: Language): LanguageDto {
  return {
    code: language.code,
    languageTag: language.languageTag,
    acceptLanguageAliases: [...language.acceptLanguageAliases],
    direction: language.direction,
    fallback: language.fallback,
    label: language.label,
    nativeLabel: language.nativeLabel,
    builtIn: false,
  };
}

function canonicalLanguageTag(tag: string): string {
  try {
    return Intl.getCanonicalLocales(tag)[0] ?? tag;
  } catch {
    throw new AppError(422, "VALIDATION_FAILED", "The language tag is invalid.", [
      {
        path: "body.languageTag",
        code: "INVALID_VALUE",
        message: "Enter a valid BCP 47 language tag.",
      },
    ]);
  }
}

export async function listLanguages(): Promise<LanguageListDto> {
  const custom = await LanguageModel.find().sort({ createdAt: 1, code: 1 }).lean();
  return { languages: [...builtInLanguages, ...custom.map(toDto)] };
}

export async function listLanguageCodes(): Promise<LocaleCode[]> {
  return (await listLanguages()).languages.map(({ code }) => code);
}

export async function getLanguage(code: string): Promise<LanguageDto | undefined> {
  const builtIn = builtInLanguages.find((language) => language.code === code);
  if (builtIn !== undefined) return builtIn;
  const custom = await LanguageModel.findOne({ code }).lean();
  return custom === null ? undefined : toDto(custom);
}

export async function requireLanguage(code: string): Promise<LanguageDto> {
  const language = await getLanguage(code);
  if (language === undefined) {
    throw new AppError(422, "UNSUPPORTED_LOCALE", `The locale “${code}” is not enabled.`);
  }
  return language;
}

export async function assertLanguagesExist(codes: Iterable<string>): Promise<void> {
  const unique = [...new Set(codes)];
  const enabled = new Set(await listLanguageCodes());
  const unsupported = unique.find((code) => !enabled.has(code));
  if (unsupported !== undefined) {
    throw new AppError(
      422,
      "UNSUPPORTED_LOCALE",
      `The locale “${unsupported}” is not enabled.`,
    );
  }
}

export async function createLanguage(
  input: CreateLanguageRequest,
  admin: SafeAdminDto,
): Promise<LanguageDto> {
  const existing = await listLanguages();
  if (existing.languages.some(({ code }) => code === input.code)) {
    throw new AppError(409, "LANGUAGE_CODE_EXISTS", "That language route code already exists.");
  }
  if (!existing.languages.some(({ code }) => code === input.fallback)) {
    throw new AppError(422, "UNSUPPORTED_FALLBACK", "Choose an existing fallback language.");
  }

  const languageTag = canonicalLanguageTag(input.languageTag);
  const aliases = input.acceptLanguageAliases.map(canonicalLanguageTag);
  const candidateTags = new Set(
    [input.code, languageTag, ...aliases].map((value) => value.toLowerCase()),
  );
  const normalizedAliases = aliases.map((value) => value.toLowerCase());
  if (
    new Set(normalizedAliases).size !== normalizedAliases.length ||
    normalizedAliases.some(
      (alias) => alias === input.code || alias === languageTag.toLowerCase(),
    )
  ) {
    throw new AppError(422, "DUPLICATE_LANGUAGE_TAG", "Language tags and aliases must be unique.");
  }
  for (const language of existing.languages) {
    const existingTags = [
      language.code,
      language.languageTag,
      ...language.acceptLanguageAliases,
    ].map((value) => value.toLowerCase());
    if (existingTags.some((tag) => candidateTags.has(tag))) {
      throw new AppError(
        409,
        "LANGUAGE_TAG_EXISTS",
        `A language already handles the tag “${existingTags.find((tag) => candidateTags.has(tag))}”.`,
      );
    }
  }

  const actor = new Types.ObjectId(admin.id);
  try {
    const created = await LanguageModel.create({
      ...input,
      languageTag,
      acceptLanguageAliases: aliases,
      createdBy: actor,
      updatedBy: actor,
    });
    return toDto(created.toObject());
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new AppError(409, "LANGUAGE_EXISTS", "That language already exists.");
    }
    throw error;
  }
}

export function defaultLanguage(): LanguageDto {
  return builtInLanguages.find(({ code }) => code === DEFAULT_LOCALE) ?? builtInLanguages[0]!;
}
