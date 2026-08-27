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

export const languageDtoSchema = z.object({
  code: localeCodeSchema,
  languageTag: languageTagSchema,
  acceptLanguageAliases: z.array(languageTagSchema).max(20),
  direction: languageDirectionSchema,
  fallback: localeCodeSchema,
  label: z.string().trim().min(1).max(80),
  nativeLabel: z.string().trim().min(1).max(80),
  builtIn: z.boolean(),
});

export const languageListDtoSchema = z.object({
  languages: z.array(languageDtoSchema).min(1),
});

export const createLanguageRequestSchema = languageDtoSchema
  .omit({ builtIn: true })
  .strict()
  .refine(({ code, fallback }) => code !== fallback, {
    path: ["fallback"],
    message: "A new language cannot fall back to itself.",
  });

export type LanguageDto = z.infer<typeof languageDtoSchema>;
export type LanguageListDto = z.infer<typeof languageListDtoSchema>;
export type CreateLanguageRequest = z.infer<typeof createLanguageRequestSchema>;
