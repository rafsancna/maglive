import { z } from "zod";
import { objectIdStringSchema } from "./api.js";
import { LOCALE_CODES } from "./locale.js";

export const categorySlugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const categorySummaryDtoSchema = z.object({
  id: objectIdStringSchema,
  slug: categorySlugSchema,
  name: z.string().min(1).max(160),
  parentId: objectIdStringSchema.nullable(),
  availableLocales: z.array(z.enum(LOCALE_CODES)).min(1)
});
export type CategorySummaryDto = z.infer<typeof categorySummaryDtoSchema>;
