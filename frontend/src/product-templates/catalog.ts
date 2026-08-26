import { PRODUCT_TEMPLATE_IDS, type ProductTemplateId } from "@maglive/contracts";
export const PRODUCT_TEMPLATE_CATALOG: Readonly<Record<ProductTemplateId, Readonly<{ label: string; description: string }>>> = {
  standard: { label: "Standard", description: "Focused product overview for every product family." },
  "topcon-premium": { label: "Topcon Premium", description: "Editorial layout for premium module storytelling." },
};
export function templateLabel(id: ProductTemplateId): string { return PRODUCT_TEMPLATE_CATALOG[id]?.label ?? "Standard"; }
export const templateIds = PRODUCT_TEMPLATE_IDS;

