import { megaMenuMockData } from "@/data/navigation/megaMenuMockData";
import { getPublicNavigation } from "@/lib/public-api";
import type { NavigationData } from "@maglive/contracts";
import type { NavigationMockData } from "@/types/navigation";

function fromApi(data: NavigationData): NavigationMockData {
  const visible = <T extends { visible?: boolean; order?: number }>(items: readonly T[]) => items.filter((item) => item.visible !== false).sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const image = (value: NavigationData["featuredProducts"][number]["image"], fallbackLabel: Record<string, string>) => value === undefined ? undefined : { ...value, alt: value.alt ?? fallbackLabel };
  const product = <T extends NavigationData["featuredProducts"][number]>(value: T) => ({ ...value, image: image(value.image, value.label) ?? { src: "/nav/solar.jpg", alt: value.label, width: 1_200, height: 800 }, ...(value.tag === undefined ? {} : { tag: value.tag }) });
  const featuredProducts = visible(data.featuredProducts).map(product);
  const productCategories = visible(data.productCategories).map((category) => ({ ...category, products: visible(category.products).map(product) }));
  const solutionCategories = visible(data.solutionCategories).map((category) => ({ ...category, feature: category.feature === undefined ? undefined : { ...product(category.feature), kicker: category.feature.tag ?? { en: "System thinking", zh: "系统化思维" } } }));
  return {
    ...data,
    productCategories,
    featuredProducts,
    solutionCategories,
    featuredSolution: { ...product(data.featuredSolution), kicker: data.featuredSolution.tag ?? { en: "System thinking", zh: "系统化思维" } },
    cases: visible(data.cases).map(product),
    news: visible(data.news).map(product),
    documents: visible(data.documents),
    services: visible(data.services),
  } as NavigationMockData;
}

export async function getNavigationData(): Promise<NavigationMockData> {
  try {
    return fromApi(await getPublicNavigation());
  } catch {
    return megaMenuMockData;
  }
}
