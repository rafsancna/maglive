import type { LocaleCode, PublicCategoryTreeNode, PublicProductSummaryDto } from "@maglive/contracts";
import { productPath } from "@/lib/product-path";
import { ResponsiveMediaImage } from "@/components/media/ResponsiveMedia";
import { ArrowRightIcon } from "@/components/ui/icons";
import { LocaleLink } from "../site/LocaleLink";

/**
 * One accessible link per card: the title link's stretched hit area covers the
 * whole tile, so the image and copy are clickable without duplicating the
 * product name in the accessibility tree.
 */
export function ProductCard({
  product,
  locale,
  index,
  viewLabel,
}: {
  product: PublicProductSummaryDto;
  locale: LocaleCode;
  index: number;
  viewLabel: string;
}) {
  const media = product.primaryMedia;
  return (
    <article className="product-tile">
      <div className="product-tile__media">
        {media === undefined ? (
          <span aria-hidden="true" className="product-tile__placeholder">
            {String(index + 1).padStart(2, "0")}
          </span>
        ) : (
          <ResponsiveMediaImage
            alt=""
            className="product-tile__image"
            media={media}
            sizes="(max-width: 42rem) 100vw, (max-width: 72rem) 50vw, 33vw"
          />
        )}
        <span aria-hidden="true" className="product-tile__index">
          {String(index + 1).padStart(2, "0")}
        </span>
      </div>
      <div className="product-tile__body">
        <p className="product-tile__meta">
          <span>{product.category.name}</span>
          {product.model === undefined ? null : <span className="product-tile__model">{product.model}</span>}
        </p>
        <h2 className="product-tile__title">
          <LocaleLink href={productPath(product)} locale={locale}>
            {product.name}
          </LocaleLink>
        </h2>
        <p className="product-tile__text">{product.shortDescription}</p>
        <span aria-hidden="true" className="product-tile__action">
          {viewLabel}
          <ArrowRightIcon />
        </span>
      </div>
    </article>
  );
}

export function CategoryTree({
  nodes,
  locale,
  activeSlug,
}: {
  nodes: readonly PublicCategoryTreeNode[];
  locale: LocaleCode;
  activeSlug?: string | undefined;
}) {
  return (
    <ul className="category-list">
      {nodes.map((node) => (
        <li key={node.id}>
          <LocaleLink
            aria-current={node.slug === activeSlug ? "page" : undefined}
            className={`category-list__link ${node.slug === activeSlug ? "is-active" : ""}`.trim()}
            href={`/products/category/${node.slug}`}
            locale={locale}
          >
            <span>{node.name}</span>
            {node.description === undefined ? null : <small>{node.description}</small>}
          </LocaleLink>
          {node.children.length === 0 ? null : (
            <CategoryTree
              {...(activeSlug === undefined ? {} : { activeSlug })}
              locale={locale}
              nodes={node.children}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

export function CategoryLanguageSwitcher({
  slug,
  locale,
  availableLocales,
}: {
  slug: string;
  locale: LocaleCode;
  availableLocales: readonly LocaleCode[];
}) {
  if (availableLocales.length < 2) return null;
  return (
    <nav aria-label="Category languages" className="lang-tabs">
      {availableLocales.map((candidate) => (
        <LocaleLink
          aria-current={candidate === locale ? "page" : undefined}
          className="lang-tabs__link"
          href={`/products/category/${slug}`}
          key={candidate}
          locale={candidate}
        >
          {candidate.toUpperCase()}
        </LocaleLink>
      ))}
    </nav>
  );
}

export function CatalogPagination({
  basePath,
  locale,
  page,
  totalPages,
  labels,
}: {
  basePath: string;
  locale: LocaleCode;
  page: number;
  totalPages: number;
  labels: { previous: string; next: string; pageInfo: string };
}) {
  if (totalPages <= 1) return null;
  const href = (target: number) => (target <= 1 ? basePath : `${basePath}?page=${target}`);
  return (
    <nav aria-label="Pagination" className="pagination">
      <LocaleLink
        aria-disabled={page <= 1}
        className="pagination__link"
        href={href(page <= 1 ? 1 : page - 1)}
        locale={locale}
      >
        {labels.previous}
      </LocaleLink>
      <span className="pagination__status">
        {labels.pageInfo.replace("{page}", String(page)).replace("{total}", String(totalPages))}
      </span>
      <LocaleLink
        aria-disabled={page >= totalPages}
        className="pagination__link"
        href={href(page >= totalPages ? totalPages : page + 1)}
        locale={locale}
      >
        {labels.next}
      </LocaleLink>
    </nav>
  );
}
