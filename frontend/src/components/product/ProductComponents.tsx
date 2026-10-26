import type { ProductPageViewModel } from "@/lib/product-view-model";
import { productPath } from "@/lib/product-path";
import type { ProductCopy } from "@/i18n/dictionary";
import { ArrowRightIcon, ArrowUpRightIcon, DownloadIcon } from "@/components/ui/icons";
import { LocaleLink } from "../site/LocaleLink";
import { ResponsiveMediaImage, ResponsiveVideoSources } from "../media/ResponsiveMedia";

export function ProductBreadcrumb({
  product,
  copy,
  breadcrumbLabel,
  productsLabel,
}: {
  product: ProductPageViewModel;
  copy: ProductCopy;
  breadcrumbLabel: string;
  productsLabel: string;
}) {
  return (
    <div className="product-hero__top">
      <nav aria-label={breadcrumbLabel} className="breadcrumb breadcrumb--onDark">
        <LocaleLink href="/products" locale={product.locale}>
          {productsLabel}
        </LocaleLink>
        {product.category.breadcrumbs.map((item) => (
          <span key={item.slug}>
            <LocaleLink href={`/products/category/${item.slug}`} locale={product.locale}>
              {item.name}
            </LocaleLink>
          </span>
        ))}
        <span aria-current="page">{product.name}</span>
      </nav>
      {product.availableLocales.length < 2 ? null : (
        <nav aria-label={copy.languages} className="lang-tabs lang-tabs--onDark">
          {product.availableLocales.map((locale) => (
            <LocaleLink
              aria-current={locale === product.locale ? "page" : undefined}
              className="lang-tabs__link"
              href={productPath(product)}
              key={locale}
              locale={locale}
            >
              {locale.toUpperCase()}
            </LocaleLink>
          ))}
        </nav>
      )}
    </div>
  );
}

export function ProductSpecifications({
  groups,
  title,
}: {
  groups: ProductPageViewModel["specifications"];
  title: string;
}) {
  if (groups.length === 0) return null;
  return (
    <section aria-labelledby="product-specifications-title" className="product-section product-specs">
      <header className="product-section__head">
        <p className="eyebrow">04 / {title}</p>
        <h2 id="product-specifications-title">{title}</h2>
      </header>
      <div className="product-specs__grid">
        {groups.map((group) => (
          <div className="product-specs__group" key={group.key}>
            <h3>{group.label}</h3>
            <dl>
              {group.items.map((item) => (
                <div key={item.key}>
                  <dt>{item.label}</dt>
                  <dd>
                    {item.value}
                    {item.unit ? ` ${item.unit}` : ""}
                    {item.note ? <small>{item.note}</small> : null}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductMedia({
  product,
  title,
}: {
  product: ProductPageViewModel;
  title: string;
}) {
  const gallery = product.media.filter(
    (item) => item.kind === "image" && item.role !== "hero",
  );
  if (gallery.length === 0) return null;
  return (
    <section aria-labelledby="product-media-title" className="product-section product-gallery">
      <header className="product-section__head">
        <p className="eyebrow">05 / {title}</p>
        <h2 id="product-media-title">{title}</h2>
      </header>
      <div className="product-gallery__grid">
        {gallery.map((item) => (
          <figure key={`${item.id}-${item.order}`}>
            <ResponsiveMediaImage
              alt={item.alt ?? item.caption ?? title}
              media={item}
              sizes="(max-width: 48rem) 100vw, 33vw"
            />
            {item.caption === undefined ? null : <figcaption>{item.caption}</figcaption>}
          </figure>
        ))}
      </div>
    </section>
  );
}

export function ProductDownloads({
  product,
  title,
}: {
  product: ProductPageViewModel;
  title: string;
}) {
  const downloads = product.media.filter((item) => item.kind === "document");
  if (downloads.length === 0) return null;
  return (
    <section aria-labelledby="product-downloads-title" className="product-section product-downloads">
      <header className="product-section__head">
        <p className="eyebrow">06 / {title}</p>
        <h2 id="product-downloads-title">{title}</h2>
      </header>
      <ul>
        {downloads.map((item) => (
          <li key={`${item.id}-${item.role}-${item.order}`}>
            <a href={item.url} rel="noreferrer" target="_blank">
              <DownloadIcon />
              <span>{item.title ?? item.caption ?? item.role}</span>
              <ArrowUpRightIcon />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProductVideos({
  product,
  title,
}: {
  product: ProductPageViewModel;
  title: string;
}) {
  const videos = product.media.filter((item) => item.kind === "video" && item.role !== "backgroundVideo");
  if (videos.length === 0) return null;
  return (
    <section aria-labelledby="product-videos-title" className="product-section product-videos">
      <header className="product-section__head">
        <p className="eyebrow">07 / {title}</p>
        <h2 id="product-videos-title">{title}</h2>
      </header>
      <div className="product-gallery__grid">
        {videos.map((item) => (
          <figure key={`${item.id}-${item.order}`}>
            <video controls playsInline poster={item.poster?.url} preload="metadata">
              <ResponsiveVideoSources
                fallbackMimeType={item.mimeType}
                fallbackUrl={item.url}
                variants={item.variants}
              />
            </video>
            {item.caption === undefined && item.title === undefined ? null : (
              <figcaption>{item.caption ?? item.title}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

export function RelatedProducts({
  product,
  title,
  viewLabel,
}: {
  product: ProductPageViewModel;
  title: string;
  viewLabel: string;
}) {
  if (product.relatedProducts.length === 0) return null;
  return (
    <section aria-labelledby="product-related-title" className="product-section product-related">
      <header className="product-section__head">
        <p className="eyebrow">08 / {title}</p>
        <h2 id="product-related-title">{title}</h2>
      </header>
      <ul className="product-related__grid">
        {product.relatedProducts.map((item) => (
          <li key={item.id}>
            <LocaleLink href={productPath(item)} locale={product.locale}>
              <span className="product-related__name">{item.name}</span>
              <span className="product-related__text">{item.shortDescription}</span>
              <span aria-hidden="true" className="product-related__action">
                {viewLabel}
                <ArrowRightIcon />
              </span>
            </LocaleLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function EnquiryCta({
  locale,
  copy,
}: {
  locale: ProductPageViewModel["locale"];
  copy: ProductCopy;
}) {
  return (
    <section className="cta-band">
      <div className="container cta-band__inner">
        <div className="cta-band__copy">
          <p className="eyebrow">{copy.enquiryEyebrow}</p>
          <h2>{copy.enquiryTitle}</h2>
          <p>{copy.enquiryText}</p>
        </div>
        <LocaleLink className="cta cta--onDark" href="/contact" locale={locale}>
          {copy.enquiryAction}
          <ArrowRightIcon />
        </LocaleLink>
      </div>
    </section>
  );
}