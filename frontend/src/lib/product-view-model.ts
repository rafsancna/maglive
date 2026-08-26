import type { LocaleCode, PublicProductDetailDto, PublicProductSummaryDto } from "@maglive/contracts";

export type ProductPageViewModel = PublicProductDetailDto & Readonly<{ locale: LocaleCode }>;
export type ProductCardViewModel = PublicProductSummaryDto & Readonly<{ locale: LocaleCode }>;

export function toProductPageViewModel(dto: PublicProductDetailDto, locale: LocaleCode): ProductPageViewModel {
  return { ...dto, locale };
}

export function toProductCardViewModel(dto: PublicProductSummaryDto, locale: LocaleCode): ProductCardViewModel {
  return { ...dto, locale };
}

