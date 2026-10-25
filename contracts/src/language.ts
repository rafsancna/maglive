import { z } from "zod";

import { localeCodeSchema } from "./locale.js";

export const languageTagSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(
    /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/,
    "Expected a BCP 47 language tag",
  );

export const languageDirectionSchema = z.enum(["ltr", "rtl"]);

export const countryCodeSchema = z
  .string()
  .trim()
  .length(2)
  .regex(/^[A-Z]{2}$/, "Expected an ISO 3166-1 alpha-2 country code");

export const languageDtoSchema = z.object({
  code: localeCodeSchema,
  languageTag: languageTagSchema,
  acceptLanguageAliases: z.array(languageTagSchema).max(20),
  direction: languageDirectionSchema,
  fallback: localeCodeSchema,
  label: z.string().trim().min(1).max(80),
  nativeLabel: z.string().trim().min(1).max(80),
  builtIn: z.boolean(),
  /** ISO 3166-1 alpha-2 code of the flag that represents this language. */
  countryCode: countryCodeSchema.optional(),
  /**
   * Absolute URL of the stored flag. Websites should prefer the same-origin
   * `flagPublicPath(countryCode)` so the link keeps working behind any proxy,
   * domain or IP address.
   */
  flagUrl: z.url().max(2048).optional(),
});

export const languageListDtoSchema = z.object({
  languages: z.array(languageDtoSchema).min(1),
});

export const createLanguageRequestSchema = languageDtoSchema
  .omit({ builtIn: true, countryCode: true, flagUrl: true })
  .strict()
  .refine(({ code, fallback }) => code !== fallback, {
    path: ["fallback"],
    message: "A new language cannot fall back to itself.",
  });

export type LanguageDto = z.infer<typeof languageDtoSchema>;
export type LanguageListDto = z.infer<typeof languageListDtoSchema>;
export type CreateLanguageRequest = z.infer<typeof createLanguageRequestSchema>;
