import type { LocaleCode } from "@maglive/contracts";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductPageRenderer } from "@/product-templates/ProductPageRenderer";
import { PublicApiError, getPublicProduct, getPublicProductVisibility, getPublicProductWithVisibility } from "@/lib/public-api";
import { toProductPageViewModel } from "@/lib/product-view-model";
import { requireLocale } from "@/i18n/page-locale";
import { cookies, draftMode } from "next/headers";
import { getPreviewProduct } from "@/lib/preview-api";
import { productMetadata } from "@/lib/seo";
import { StructuredData } from "@/lib/structured-data";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; productSlug: string }> }): Promise<import("next").Metadata> {
  const { locale: rawLocale, productSlug } = await params;
  const locale = await requireLocale(Promise.resolve({ locale: rawLocale })) as LocaleCode;
  if ((await draftMode()).isEnabled) return { title: "Preview", robots: { index: false, follow: false } };
  try {
    const visibility = await getPublicProductVisibility(productSlug, locale);
    const dto = await getPublicProduct(productSlug, locale, visibility.publicationRevision);
    return productMetadata(dto, locale);
  } catch {
    return { title: "Product" };
  }
}

export default async function ProductDetailPage({ params }: { params: Promise<{ locale: string; productSlug: string }> }) {
  const { locale: rawLocale, productSlug } = await params;
  const locale = await requireLocale(Promise.resolve({ locale: rawLocale })) as LocaleCode;
  const mode = await draftMode();
  if (mode.isEnabled) {
    const credential = (await cookies()).get("maglive_preview")?.value;
    if (!credential) return <section className="product-route-error" role="alert"><h1>Preview unavailable</h1><p>This preview session has expired. Return to the Product editor and create a new preview.</p></section>;
    let draft: Awaited<ReturnType<typeof getPreviewProduct>> | null = null;
    let previewFailure = false;
    try { draft = await getPreviewProduct(credential); } catch { previewFailure = true; }
    const localized = draft?.translations[locale] ?? draft?.translations.en;
    if (previewFailure || draft === null || localized === undefined) return <section className="product-route-error" role="alert"><h1>Preview unavailable</h1><p>This preview has expired or the draft changed. Return to the Product editor and create a new preview.</p><Link className="admin-button" href="/admin/products">Return to editor</Link></section>;
    return <article className="product-page product-page--preview"><div className="preview-banner"><strong>Preview</strong><span>Saved working copy; not indexed or published.</span><Link href="/api/internal/preview/exit">Exit preview</Link></div><header className="product-hero"><div className="product-hero__copy"><span className="eyebrow">Draft preview</span><h1>{localized.name}</h1><p>{localized.shortDescription}</p></div></header><section className="product-section"><h2>Overview</h2><div className="product-markdown">{localized.longDescriptionMarkdown ?? localized.shortDescription}</div></section></article>;
  }
  let dto: Awaited<ReturnType<typeof getPublicProduct>> | null = null;
  let failure: unknown;
  try {
    dto = await getPublicProductWithVisibility(productSlug, locale);
  } catch (error) {
    failure = error;
  }
  if (failure instanceof PublicApiError && failure.status === 404) notFound();
  if (failure !== undefined || dto === null) return <section className="product-route-error" role="alert"><h1>Product temporarily unavailable</h1><p>We could not load this product right now. Please retry shortly.</p></section>;
  return <><ProductPageRenderer product={toProductPageViewModel(dto, locale)} templateId={dto.pageTemplate} /><StructuredData locale={locale} product={dto} /></>;
}
