import type { ProductPageViewModel } from "@/lib/product-view-model";
import type { ProductCopy } from "@/i18n/dictionary";
import { StandardTemplate } from "./Standard";
import { TopconPremiumTemplate } from "./TopconPremium";

export function ProductPageRenderer({
  product,
  templateId,
  copy,
  breadcrumbLabel,
  productsLabel,
  viewLabel,
}: {
  product: ProductPageViewModel;
  templateId: string;
  copy: ProductCopy;
  breadcrumbLabel: string;
  productsLabel: string;
  viewLabel: string;
}) {
  const Template = templateId === "topcon-premium" ? TopconPremiumTemplate : StandardTemplate;
  return (
    <Template
      breadcrumbLabel={breadcrumbLabel}
      copy={copy}
      product={product}
      productsLabel={productsLabel}
      viewLabel={viewLabel}
    />
  );
}
