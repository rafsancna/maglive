import type { LocaleCode } from "@maglive/contracts";
import { notFound, permanentRedirect } from "next/navigation";
import { ProductPageRenderer } from "@/product-templates/ProductPageRenderer";
import { PublicApiError, getPublicProduct, getPublicProductVisibility, getPublicProductWithVisibility } from "@/lib/public-api";
import { toProductPageViewModel } from "@/lib/product-view-model";
import { requireLocale } from "@/i18n/page-locale";
import { draftMode } from "next/headers";
import { productMetadata } from "@/lib/seo";
import { StructuredData } from "@/lib/structured-data";
import { getAvailableLanguages } from "@/i18n/languages";
import { productPath } from "@/lib/product-path";
import { getDictionary } from "@/i18n/get-dictionary";

type ProductRouteParams = Promise<{
  locale: string;
  categorySlug: string;
  productSlug: string;
}>;

export async function generateMetadata({ params }: { params: ProductRouteParams }): Promise<import("next").Metadata> {
  const { locale: rawLocale, productSlug } = await params;
  const locale = await requireLocale(Promise.resolve({ locale: rawLocale })) as LocaleCode;
  if ((await draftMode()).isEnabled) {
    return { title: "Preview", robots: { index: false, follow: false } };
  }
  try {
    const visibility = await getPublicProductVisibility(productSlug, locale);
    const dto = await getPublicProduct(productSlug, locale, visibility.publicationRevision);
    return productMetadata(dto, locale, await getAvailableLanguages());
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductDetailPage({ params }: { params: ProductRouteParams }) {
  const { locale: rawLocale, categorySlug, productSlug } = await params;
  const locale = await requireLocale(Promise.resolve({ locale: rawLocale })) as LocaleCode;
  if ((await draftMode()).isEnabled) {
    permanentRedirect(`/${locale}/products/${productSlug}`);
  }
  let dto: Awaited<ReturnType<typeof getPublicProduct>> | null = null;
  let failure: unknown;
  try {
    dto = await getPublicProductWithVisibility(productSlug, locale);
  } catch (error) {
    failure = error;
  }
  if (failure instanceof PublicApiError && failure.status === 404) notFound();
  if (failure !== undefined || dto === null) {
    return (
      <section className="product-route-error" role="alert">
        <h1>Product temporarily unavailable</h1>
        <p>We could not load this product right now. Please retry shortly.</p>
      </section>
    );
  }
  if (dto.category.slug !== categorySlug) {
    permanentRedirect(`/${locale}${productPath(dto)}`);
  }
  const dictionary = await getDictionary(locale);
  return (
    <>
      <ProductPageRenderer
        breadcrumbLabel={dictionary.accessibility.breadcrumb}
        copy={dictionary.product}
        product={toProductPageViewModel(dto, locale)}
        productsLabel={dictionary.catalog.breadcrumbProducts}
        templateId={dto.pageTemplate}
        viewLabel={dictionary.catalog.viewProduct}
      />
      <StructuredData locale={locale} product={dto} />
    </>
  );
}
