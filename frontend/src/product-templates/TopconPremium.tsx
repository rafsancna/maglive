import type { ProductTemplateProps } from "./types";
import { ResponsiveMediaImage } from "@/components/media/ResponsiveMedia";
import { Container } from "@/components/ui/Container";
import {
  EnquiryCta,
  ProductBreadcrumb,
  ProductDownloads,
  ProductMedia,
  ProductVideos,
  ProductSpecifications,
  RelatedProducts,
} from "@/components/product/ProductComponents";

export function TopconPremiumTemplate({ product, copy, breadcrumbLabel, productsLabel, viewLabel }: ProductTemplateProps) {
  const hero = product.media.find((item) => item.role === "hero");

  return (
    <article className="product-page product-page--premium">
      <header className="premium-hero">
        {hero === undefined ? null : (
          <div className="premium-hero__media" aria-hidden="true">
            <ResponsiveMediaImage
              alt=""
              className="premium-hero__image"
              media={hero}
              preload
              sizes="100vw"
            />
          </div>
        )}
        <Container className="premium-hero__inner">
          <ProductBreadcrumb
            breadcrumbLabel={breadcrumbLabel}
            copy={copy}
            product={product}
            productsLabel={productsLabel}
          />
          <div className="premium-hero__copy">
            <p className="eyebrow">{copy.premiumSeries}</p>
            <h1>{product.name}</h1>
            <p className="premium-hero__lede">{product.shortDescription}</p>
            <dl className="premium-hero__facts">
              {product.model === undefined ? null : (
                <div>
                  <dt>{copy.model}</dt>
                  <dd>{product.model}</dd>
                </div>
              )}
              {product.series === undefined ? null : (
                <div>
                  <dt>{copy.series}</dt>
                  <dd>{product.series}</dd>
                </div>
              )}
              <div>
                <dt>{copy.category}</dt>
                <dd>{product.category.name}</dd>
              </div>
            </dl>
          </div>
        </Container>
      </header>

      <section className="product-section premium-technology">
        <Container className="premium-technology__inner">
          <header className="product-section__head">
            <p className="eyebrow">01 / {copy.technology}</p>
            <h2 id="product-technology-title">{copy.technology}</h2>
          </header>
          <p className="premium-technology__body">{product.longDescriptionMarkdown ?? product.shortDescription}</p>
        </Container>
      </section>

      {product.advantages.length === 0 ? null : (
        <section className="product-section premium-advantages">
          <Container>
            <header className="product-section__head">
              <p className="eyebrow">02 / {copy.advantages}</p>
              <h2>{copy.advantages}</h2>
            </header>
            <ol className="product-details__grid">
              {product.advantages.map((item, index) => (
                <li key={item.key}>
                  <span className="product-details__index">{String(index + 1).padStart(2, "0")}</span>
                  <h3>{item.title}</h3>
                  {item.body === undefined ? null : <p>{item.body}</p>}
                </li>
              ))}
            </ol>
          </Container>
        </section>
      )}

      {product.features.length === 0 ? null : (
        <section className="product-section premium-features">
          <Container>
            <header className="product-section__head">
              <p className="eyebrow">03 / {copy.features}</p>
              <h2>{copy.features}</h2>
            </header>
            <ul className="product-details__list product-details__list--wide">
              {product.features.map((item) => (
                <li key={item.key}>
                  <strong>{item.title}</strong>
                  {item.body === undefined ? null : <span>{item.body}</span>}
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <ProductSpecifications groups={product.specifications} title={copy.specifications} />
      <ProductMedia product={product} title={copy.media} />
      <ProductVideos product={product} title={copy.videos} />
      <ProductDownloads product={product} title={copy.downloads} />
      <RelatedProducts product={product} title={copy.related} viewLabel={viewLabel} />
      <EnquiryCta copy={copy} locale={product.locale} />
    </article>
  );
}
