import type { ProductPageViewModel } from "@/lib/product-view-model";
import { StandardTemplate } from "./Standard";
import { TopconPremiumTemplate } from "./TopconPremium";

export function ProductPageRenderer({ product, templateId }: { product: ProductPageViewModel; templateId: string }) {
  const Template = templateId === "topcon-premium" ? TopconPremiumTemplate : StandardTemplate;
  return <Template product={product} />;
}
