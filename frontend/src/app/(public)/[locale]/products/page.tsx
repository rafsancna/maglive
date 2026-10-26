import type { LocaleCode } from "@maglive/contracts";
import { Container } from "@/components/ui/Container";
import { CategoryTree, ProductCard } from "@/components/product/Catalog";
import { getPublicCategoryTree, listPublicProducts } from "@/lib/public-api";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale, type LocalizedPageProps } from "@/i18n/page-locale";

export default async function ProductsPage({ params }: LocalizedPageProps) {
  const locale = (await requireLocale(params)) as LocaleCode;
  const dictionary = await getDictionary(locale);
  const copy = dictionary.pages.products;
  const labels = dictionary.catalog;

  let tree: Awaited<ReturnType<typeof getPublicCategoryTree>> | null = null;
  let products: Awaited<ReturnType<typeof listPublicProducts>> | null = null;
  let failed = false;

  try {
    const [categoryTree, result] = await Promise.all([
      getPublicCategoryTree(locale),
      listPublicProducts({ page: 1, limit: 24, locale, sort: "order-asc" }),
    ]);
    tree = categoryTree;
    products = result;
  } catch {
    failed = true;
  }

  return (
    <div className="page">
      <section className="page-hero page-hero--compact">
        <Container>
          <div className="page-hero__meta">
            <p className="eyebrow">{copy.eyebrow}</p>
            <span className="page-hero__rule" aria-hidden="true" />
          </div>
          <h1 className="page-hero__title">{copy.title}</h1>
          <div className="page-hero__body">
            <p className="page-hero__lede">{copy.intro}</p>
          </div>
        </Container>
      </section>

      <Container className="catalog">
        {failed || tree === null || products === null ? (
          <div className="notice" role="alert">
            <p className="eyebrow">System status</p>
            <h2>{labels.unavailableTitle}</h2>
            <p>{labels.unavailableText}</p>
          </div>
        ) : (
          <div className="catalog__layout">
            <aside className="catalog__aside">
              <h2>{labels.categories}</h2>
              {tree.categories.length === 0 ? (
                <p className="catalog__aside-empty">{labels.emptyText}</p>
              ) : (
                <CategoryTree locale={locale} nodes={tree.categories} />
              )}
            </aside>
            <div className="catalog__main">
              <div className="catalog__bar">
                <span className="catalog__count">
                  {labels.allProducts} <i aria-hidden="true" /> {String(products.items.length).padStart(2, "0")}
                </span>
              </div>
              {products.items.length === 0 ? (
                <div className="catalog__empty">
                  <h2>{labels.emptyTitle}</h2>
                  <p>{labels.emptyText}</p>
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
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
