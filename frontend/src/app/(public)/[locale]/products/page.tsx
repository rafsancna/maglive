import type { LocaleCode } from "@maglive/contracts";
import { ContentPage } from "@/components/site/ContentPage";
import { CategoryTree, ProductCard } from "@/components/product/Catalog";
import { PublicApiError, getPublicCategoryTree, listPublicProducts } from "@/lib/public-api";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale, type LocalizedPageProps } from "@/i18n/page-locale";

export default async function ProductsPage({ params }: LocalizedPageProps) {
  const locale = await requireLocale(params) as LocaleCode;
  const dictionary = await getDictionary(locale);
  let data: Awaited<ReturnType<typeof getPublicCategoryTree>> | null = null;
  let products: Awaited<ReturnType<typeof listPublicProducts>> | null = null;
  let failure: unknown;
  try {
    const [tree, result] = await Promise.all([
      getPublicCategoryTree(locale),
      listPublicProducts({ page: 1, limit: 24, locale, sort: "order-asc" }),
    ]);
    data = tree;
    products = result;
  } catch (error) {
    failure = error;
  }
  if (failure instanceof PublicApiError && failure.status === 404) return <ContentPage copy={dictionary.pages.products} />;
  if (failure !== undefined || data === null || products === null) return <section className="catalog-page"><div className="catalog-error" role="alert"><h1>Catalog temporarily unavailable</h1><p>We could not load products right now. Please try again shortly.</p></div></section>;
  return <section className="catalog-page"><header className="catalog-page__header"><span className="eyebrow">{dictionary.pages.products.eyebrow}</span><h1>{dictionary.pages.products.title}</h1><p>{dictionary.pages.products.intro}</p></header><div className="catalog-page__layout"><aside><h2>Categories</h2><CategoryTree locale={locale} nodes={data.categories} /></aside><div><div className="catalog-grid">{products.items.map((product) => <ProductCard key={product.id} locale={locale} product={product} />)}</div>{products.items.length === 0 ? <div className="catalog-empty"><h2>No products in this language yet</h2><p>Published products will appear here when their category and translation are ready.</p></div> : null}</div></div></section>;
}
