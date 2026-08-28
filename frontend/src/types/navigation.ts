import type { LocaleCode } from "@maglive/contracts";

export type LocalizedText = Readonly<Record<string, string>>;

export type NavigationImage = Readonly<{
  src: string;
  alt: LocalizedText;
  width: number;
  height: number;
}>;

export type NavigationLink = Readonly<{
  label: LocalizedText;
  description?: LocalizedText;
  href: string;
  meta?: LocalizedText;
}>;

export type ProductCategory = Omit<NavigationLink, "description"> & Readonly<{
  description: LocalizedText;
  accent: string;
}>;

export type FeaturedProduct = Omit<NavigationLink, "description"> & Readonly<{
  description: LocalizedText;
  image: NavigationImage;
  tag: LocalizedText;
}>;

export type FeaturedSolution = Omit<NavigationLink, "description"> & Readonly<{
  description: LocalizedText;
  image: NavigationImage;
  kicker: LocalizedText;
}>;

export type CaseStudy = Omit<NavigationLink, "description"> & Readonly<{
  description: LocalizedText;
  image: NavigationImage;
  location: LocalizedText;
  capacity: LocalizedText;
}>;

export type NewsItem = Omit<NavigationLink, "description"> & Readonly<{
  description: LocalizedText;
  image: NavigationImage;
  date: LocalizedText;
  category: LocalizedText;
}>;

export type NavigationMockData = Readonly<{
  productCategories: readonly ProductCategory[];
  featuredProducts: readonly FeaturedProduct[];
  solutionCategories: readonly NavigationLink[];
  featuredSolution: FeaturedSolution;
  cases: readonly CaseStudy[];
  news: readonly NewsItem[];
  documents: readonly NavigationLink[];
  services: readonly NavigationLink[];
}>;

export function localized(text: LocalizedText, locale: LocaleCode): string {
  return text[locale] ?? text.en ?? Object.values(text)[0] ?? "";
}
