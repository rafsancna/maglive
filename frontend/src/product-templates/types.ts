import type { ProductPageViewModel } from "@/lib/product-view-model";
import type { ProductCopy } from "@/i18n/dictionary";

export type ProductTemplateProps = Readonly<{
  product: ProductPageViewModel;
  copy: ProductCopy;
  breadcrumbLabel: string;
  productsLabel: string;
  viewLabel: string;
}>;
