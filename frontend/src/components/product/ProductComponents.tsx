import type { ProductPageViewModel } from "@/lib/product-view-model";
import { productPath } from "@/lib/product-path";
import { LocaleLink } from "../site/LocaleLink";
import { ResponsiveMediaImage, ResponsiveVideoSources } from "../media/ResponsiveMedia";

export function ProductBreadcrumb({ product }: { product: ProductPageViewModel }) {
  return <div className="product-hero__navigation"><nav aria-label="Breadcrumb" className="product-breadcrumb"><LocaleLink href="/products" locale={product.locale}>Products</LocaleLink>{product.category.breadcrumbs.map((item) => <span key={item.slug}><span aria-hidden="true">/</span><LocaleLink href={`/products/category/${item.slug}`} locale={product.locale}>{item.name}</LocaleLink></span>)}<span aria-hidden="true">/</span><span aria-current="page">{product.name}</span></nav><ProductLanguageSwitcher product={product} /></div>;
}

export function ProductLanguageSwitcher({ product }: { product: ProductPageViewModel }) {
  return <nav aria-label="Product languages" className="product-language-switcher">{product.availableLocales.map((locale) => <LocaleLink aria-current={locale === product.locale ? "page" : undefined} href={productPath(product)} key={locale} locale={locale}>{locale.toUpperCase()}</LocaleLink>)}</nav>;
}

export function ProductSpecifications({ groups }: { groups: ProductPageViewModel["specifications"] }) {
  if (groups.length === 0) return null;
  return <section className="product-section product-specifications" aria-labelledby="product-specifications-title"><h2 id="product-specifications-title">Specifications</h2><div className="product-specifications__grid">{groups.map((group) => <div className="product-specifications__group" key={group.key}><h3>{group.label}</h3><dl>{group.items.map((item) => <div key={item.key}><dt>{item.label}</dt><dd>{item.value}{item.unit ? ` ${item.unit}` : ""}{item.note ? <small>{item.note}</small> : null}</dd></div>)}</dl></div>)}</div></section>;
}

export function ProductMedia({ product }: { product: ProductPageViewModel }) {
  const images = product.media.filter((item) => item.kind === "image");
  if (images.length === 0) return null;
  return <section className="product-section product-media" aria-labelledby="product-media-title"><h2 id="product-media-title">Media</h2><div className="product-media__grid">{images.map((item) => <figure key={`${item.id}-${item.role}-${item.order}`}><ResponsiveMediaImage media={item} alt={item.alt ?? product.name} sizes="(max-width: 46rem) 100vw, 33vw" /><figcaption>{item.caption ?? item.title ?? item.role}</figcaption></figure>)}</div></section>;
}

export function ProductDownloads({ product }: { product: ProductPageViewModel }) {
  const downloads = product.media.filter((item) => item.kind === "document");
  if (downloads.length === 0) return null;
  return <section className="product-section product-downloads" aria-labelledby="product-downloads-title"><h2 id="product-downloads-title">Downloads</h2><ul>{downloads.map((item) => <li key={`${item.id}-${item.role}-${item.order}`}><a href={item.url} target="_blank" rel="noreferrer">{item.title ?? item.caption ?? item.role}</a></li>)}</ul></section>;
}

export function ProductVideos({ product }: { product: ProductPageViewModel }) {
  const videos = product.media.filter((item) => item.kind === "video" && item.role !== "backgroundVideo");
  if (videos.length === 0) return null;
  return <section className="product-section product-videos" aria-labelledby="product-videos-title"><h2 id="product-videos-title">Videos</h2><div className="product-media__grid">{videos.map((item) => <figure key={`${item.id}-${item.order}`}><video controls playsInline preload="metadata" poster={item.poster?.url}><ResponsiveVideoSources fallbackMimeType={item.mimeType} fallbackUrl={item.url} variants={item.variants} /></video>{item.caption || item.title ? <figcaption>{item.caption ?? item.title}</figcaption> : null}</figure>)}</div></section>;
}

export function RelatedProducts({ product }: { product: ProductPageViewModel }) {
  if (product.relatedProducts.length === 0) return null;
  return <section className="product-section product-related" aria-labelledby="product-related-title"><h2 id="product-related-title">Related products</h2><div className="product-related__grid">{product.relatedProducts.map((item) => <article key={item.id}><h3><LocaleLink href={productPath(item)} locale={product.locale}>{item.name}</LocaleLink></h3><p>{item.shortDescription}</p></article>)}</div></section>;
}

export function EnquiryCta({ locale }: { locale: ProductPageViewModel["locale"] }) {
  return <section className="product-section product-enquiry"><h2>Need a technical recommendation?</h2><p>Our team can help match this product to your project requirements.</p><LocaleLink className="admin-button admin-button--primary" href="/contact" locale={locale}>Contact our team</LocaleLink></section>;
}
