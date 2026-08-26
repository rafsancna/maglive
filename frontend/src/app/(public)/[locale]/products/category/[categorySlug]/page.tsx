import type { LocaleCode } from "@maglive/contracts";
import { CategoryLanguageSwitcher, ProductCard } from "@/components/product/Catalog";
import { PublicApiError, getPublicCategory, listPublicProducts } from "@/lib/public-api";
import { requireLocale } from "@/i18n/page-locale";
import { LocaleLink } from "@/components/site/LocaleLink";
import { notFound } from "next/navigation";
import { categoryMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; categorySlug: string }> }): Promise<import("next").Metadata> {
  const { locale: rawLocale, categorySlug } = await params;
  const locale = await requireLocale(Promise.resolve({ locale: rawLocale })) as LocaleCode;
  try { return categoryMetadata(await getPublicCategory(categorySlug, locale), locale); } catch { return { title: "Product category" }; }
}

export default async function ProductCategoryPage({ params, searchParams }: { params: Promise<{ locale: string; categorySlug: string }>; searchParams?: Promise<{ page?: string }> }) {
  const { locale: rawLocale, categorySlug } = await params;
  const locale = await requireLocale(Promise.resolve({ locale: rawLocale })) as LocaleCode;
  const requestedPage = Number.parseInt((await searchParams)?.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  let category: Awaited<ReturnType<typeof getPublicCategory>> | null = null;
  let products: Awaited<ReturnType<typeof listPublicProducts>> | null = null;
  let failure: unknown;
  try {
    const [result, list] = await Promise.all([getPublicCategory(categorySlug, locale), listPublicProducts({ page, limit: 24, locale, category: categorySlug, sort: "order-asc" })]);
    category = result;
    products = list;
  } catch (error) {
    failure = error;
  }
  if (failure instanceof PublicApiError && failure.status === 404) notFound();
  if (failure !== undefined || category === null || products === null) return <section className="catalog-page"><div className="catalog-error" role="alert"><h1>Category temporarily unavailable</h1><p>Please retry this page shortly.</p></div></section>;
  return <section className="catalog-page"><nav aria-label="Breadcrumb" className="product-breadcrumb"><LocaleLink href="/products" locale={locale}>Products</LocaleLink>{category.breadcrumbs.map((item) => <span key={item.slug}> / {item.name}</span>)}</nav><CategoryLanguageSwitcher availableLocales={category.availableLocales} locale={locale} slug={category.slug} /><header className="catalog-page__header"><span className="eyebrow">Product category</span><h1>{category.name}</h1>{category.description ? <p>{category.description}</p> : null}</header><div className="catalog-grid">{products.items.map((product) => <ProductCard key={product.id} locale={locale} product={product} />)}</div>{products.items.length === 0 ? <div className="catalog-empty"><h2>No published products here yet</h2><p>This category is ready for products when their translations are complete.</p></div> : null}{products.pagination.totalPages > 1 ? <nav aria-label="Category pagination" className="catalog-pagination"><a aria-disabled={page <= 1} href={page <= 1 ? `/${locale}/products/category/${category.slug}` : `/${locale}/products/category/${category.slug}?page=${page - 1}`}>Previous</a><span>Page {products.pagination.page} of {products.pagination.totalPages}</span><a aria-disabled={page >= products.pagination.totalPages} href={page >= products.pagination.totalPages ? `/${locale}/products/category/${category.slug}?page=${products.pagination.totalPages}` : `/${locale}/products/category/${category.slug}?page=${page + 1}`}>Next</a></nav> : null}</section>;
}
