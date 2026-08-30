import type { LocaleCode } from "@maglive/contracts";

export type LocalizedText = Readonly<Record<string, string>>;

export type NavigationImage = Readonly<{
  src: string;
  alt: LocalizedText;
  width: number;
  height: number;
  mediaId?: string;
}>;

export type NavigationLink = Readonly<{
  id?: string;
  label: LocalizedText;
  description?: LocalizedText;
  href: string;
  meta?: LocalizedText;
  visible?: boolean;
  order?: number;
  feature?: FeaturedSolution;
}>;

export type PrimaryNavigationItem = Readonly<{
  id: string;
  label: LocalizedText;
  href: string;
  menu?: "products" | "solutions" | "cases" | "news" | "documents" | "services";
  visible?: boolean;
  order?: number;
}>;

export type ProductCategory = Omit<NavigationLink, "description"> & Readonly<{
  description: LocalizedText;
  accent: string;
  products?: readonly FeaturedProduct[];
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
  primaryItems: readonly PrimaryNavigationItem[];
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
