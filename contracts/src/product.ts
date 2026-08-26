import { z } from "zod";
import { objectIdStringSchema } from "./api.js";
import { LOCALE_CODES } from "./locale.js";
import { legacyTemplateIdSchema } from "./product-template.js";

export const productSlugSchema = z
  .string()
  .min(2)
  .max(140)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const productSummaryDtoSchema = z.object({
  id: objectIdStringSchema,
  slug: productSlugSchema,
  name: z.string().min(1).max(200),
  model: z.string().max(120).optional(),
  categoryId: objectIdStringSchema,
  pageTemplate: legacyTemplateIdSchema,
  availableLocales: z.array(z.enum(LOCALE_CODES)).min(1)
});
export type ProductSummaryDto = z.infer<typeof productSummaryDtoSchema>;
