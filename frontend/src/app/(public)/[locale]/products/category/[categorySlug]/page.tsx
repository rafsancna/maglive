import type { LocaleCode } from "@maglive/contracts";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { CatalogPagination, CategoryLanguageSwitcher, ProductCard } from "@/components/product/Catalog";
import { PublicApiError, getPublicCategory, listPublicProducts } from "@/lib/public-api";
import { requireLocale } from "@/i18n/page-locale";
import { LocaleLink } from "@/components/site/LocaleLink";
import { categoryMetadata } from "@/lib/seo";
import { getAvailableLanguages } from "@/i18n/languages";
import { CategoryStructuredData } from "@/lib/structured-data";
import { getDictionary } from "@/i18n/get-dictionary";

type CategoryRouteParams = { params: Promise<{ locale: string; categorySlug: string }>; searchParams?: Promise<{ page?: string }> };

async function resolveLocale(rawLocale: string): Promise<LocaleCode> {
  return (await requireLocale(Promise.resolve({ locale: rawLocale }))) as LocaleCode;
}

export async function generateMetadata({ params }: CategoryRouteParams): Promise<import("next").Metadata> {
  const { locale: rawLocale, categorySlug } = await params;
  const locale = await resolveLocale(rawLocale);
  try {
    const [category, languages] = await Promise.all([getPublicCategory(categorySlug, locale), getAvailableLanguages()]);
    return categoryMetadata(category, locale, languages);
  } catch {
    return { title: "Product category" };
  }
}

export default async function ProductCategoryPage({ params, searchParams }: CategoryRouteParams) {
  const { locale: rawLocale, categorySlug } = await params;
  const locale = await resolveLocale(rawLocale);
  const dictionary = await getDictionary(locale);
  const labels = dictionary.catalog;
  const requestedPage = Number.parseInt((await searchParams)?.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  let category: Awaited<ReturnType<typeof getPublicCategory>> | null = null;
  let products: Awaited<ReturnType<typeof listPublicProducts>> | null = null;
  let failed = false;
  try {
    const [result, list] = await Promise.all([
      getPublicCategory(categorySlug, locale),
      listPublicProducts({ page, limit: 24, locale, category: categorySlug, sort: "order-asc" }),
    ]);
    category = result;
    products = list;
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound();
    failed = true;
  }

  if (failed || category === null || products === null) {
    return (
      <div className="page">
        <Container className="notice-notfound" role="alert">
          <h1>{labels.unavailableTitle}</h1>
          <p>{labels.unavailableText}</p>
        </Container>
      </div>
    );
  }

  return (
    <>
      <div className="page">
        <section className="page-hero page-hero--compact">
          <Container>
            <nav aria-label={dictionary.accessibility.breadcrumb} className="breadcrumb">
              <LocaleLink href="/products" locale={locale}>
                {labels.breadcrumbProducts}
              </LocaleLink>
              {category.breadcrumbs.map((item) => (
                <span key={item.slug}>{item.name}</span>
              ))}
            </nav>
            <div className="page-hero__meta">
              <p className="eyebrow">{labels.breadcrumbCategory}</p>
              <span className="page-hero__rule" aria-hidden="true" />
              <CategoryLanguageSwitcher availableLocales={category.availableLocales} locale={locale} slug={category.slug} />
            </div>
            <h1 className="page-hero__title">{category.name}</h1>
            {category.description === undefined || category.description === "" ? null : (
              <div className="page-hero__body">
                <p className="page-hero__lede">{category.description}</p>
              </div>
            )}
          </Container>
        </section>

        <Container className="catalog">
          {products.items.length === 0 ? (
            <div className="catalog__empty">
              <h2>{labels.categoryEmptyTitle}</h2>
              <p>{labels.categoryEmptyText}</p>
            </div>
          ) : (
            <div className="product-grid">
              {products.items.map((product, index) => (
                <ProductCard
                  index={index}
                  key={product.id}
                  locale={locale}
                  product={product}
                  viewLabel={labels.viewProduct}
                />
              ))}
            </div>
          )}
          <CatalogPagination
            basePath={`/products/category/${category.slug}`}
            labels={{ next: labels.next, pageInfo: labels.pageInfo, previous: labels.previous }}
            locale={locale}
            page={products.pagination.page}
            totalPages={products.pagination.totalPages}
          />
        </Container>
      </div>
      <CategoryStructuredData category={category} locale={locale} />
    </>
  );
}
