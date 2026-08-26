import { z } from "zod";

export const PRODUCT_TEMPLATE_IDS = ["standard", "topcon-premium"] as const;
export const productTemplateIdSchema = z.enum(PRODUCT_TEMPLATE_IDS);
export type ProductTemplateId = z.infer<typeof productTemplateIdSchema>;

export const legacyTemplateIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export type LegacyTemplateId = z.infer<typeof legacyTemplateIdSchema>;

export function isProductTemplateId(value: string): value is ProductTemplateId {
  return productTemplateIdSchema.safeParse(value).success;
}
