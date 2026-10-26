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

export function StandardTemplate({ product, copy, breadcrumbLabel, productsLabel, viewLabel }: ProductTemplateProps) {
  const hero = product.media.find((item) => item.role === "hero");
  const facts = [
    product.model === undefined ? null : { label: copy.model, value: product.model },
    product.series === undefined ? null : { label: copy.series, value: product.series },
    { label: copy.category, value: product.category.name },
  ].filter((item): item is { label: string; value: string } => item !== null);

  return (
    <article className="product-page">
      <header className="product-hero">
        <Container>
          <ProductBreadcrumb
            breadcrumbLabel={breadcrumbLabel}
            copy={copy}
            product={product}
            productsLabel={productsLabel}
          />
          <div className="product-hero__inner">
            <div className="product-hero__copy">
              <p className="eyebrow">{product.category.name}</p>
              <h1>{product.name}</h1>
              <p className="product-hero__lede">{product.shortDescription}</p>
              <dl className="product-hero__facts">
                {facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {hero === undefined ? null : (
              <div className="product-hero__media">
                <ResponsiveMediaImage
                  alt={hero.alt ?? product.name}
                  className="product-hero__image"
                  media={hero}
                  preload
                  sizes="(max-width: 62rem) 100vw, 52vw"
                />
              </div>
            )}
          </div>
        </Container>
      </header>

      <section className="product-section product-overview">
        <Container className="product-overview__inner">
          <header className="product-section__head">
            <p className="eyebrow">01 / {copy.overview}</p>
            <h2>{copy.overview}</h2>
          </header>
          <div className="product-overview__body">
            <p>{product.longDescriptionMarkdown ?? product.shortDescription}</p>
            {product.warrantyInformation === undefined ? null : (
              <p className="product-overview__note">{product.warrantyInformation}</p>
            )}
          </div>
        </Container>
      </section>

      {product.features.length === 0 && product.advantages.length === 0 && product.applications.length === 0 ? null : (
        <section className="product-section product-details">
          <Container>
            {product.features.length === 0 ? null : (
              <div className="product-details__block">
                <header className="product-section__head">
                  <p className="eyebrow">02 / {copy.features}</p>
                  <h2>{copy.features}</h2>
                </header>
                <ol className="product-details__grid">
                  {product.features.map((item, index) => (
                    <li key={item.key}>
                      <span className="product-details__index">{String(index + 1).padStart(2, "0")}</span>
                      <h3>{item.title}</h3>
                      {item.body === undefined ? null : <p>{item.body}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {product.advantages.length === 0 && product.applications.length === 0 ? null : (
              <div className="product-details__split">
                {product.advantages.length === 0 ? null : (
                  <div>
                    <header className="product-section__head">
                      <p className="eyebrow">03 / {copy.advantages}</p>
                      <h2>{copy.advantages}</h2>
                    </header>
                    <ul className="product-details__list">
                      {product.advantages.map((item) => (
                        <li key={item.key}>
                          <strong>{item.title}</strong>
                          {item.body === undefined ? null : <span>{item.body}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {product.applications.length === 0 ? null : (
                  <div>
                    <header className="product-section__head">
                      <p className="eyebrow">03 / {copy.applications}</p>
                      <h2>{copy.applications}</h2>
                    </header>
                    <ul className="product-details__list">
                      {product.applications.map((item) => (
                        <li key={item.key}>
                          <strong>{item.title}</strong>
                          {item.body === undefined ? null : <span>{item.body}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
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
