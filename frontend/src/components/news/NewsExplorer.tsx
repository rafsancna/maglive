"use client";

import type { LocaleCode, PublicNewsSummaryDto } from "@maglive/contracts";
import { useMemo, useState } from "react";
import { ResponsiveMediaImage } from "../media/ResponsiveMedia";
import { LocaleLink } from "../site/LocaleLink";

function label(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function NewsExplorer({
  items,
  categories,
  locale,
}: {
  items: PublicNewsSummaryDto[];
  categories: string[];
  locale: LocaleCode;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [tag, setTag] = useState("");
  const tags = useMemo(
    () => [...new Set(items.flatMap((item) => item.tags))].sort(),
    [items],
  );
  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (!category || item.category === category) &&
          (!tag || item.tags.includes(tag)) &&
          (!search ||
            `${item.title} ${item.excerpt} ${item.tags.join(" ")}`
              .toLowerCase()
              .includes(search.toLowerCase())),
      ),
    [items, category, tag, search],
  );
  const featured = visible.find((item) => item.featured) ?? visible[0];
  const remaining = visible.filter((item) => item.id !== featured?.id);

  return (
    <div className="news-explorer">
      <div className="news-explorer__controls">
        <label className="news-explorer__search">
          <span>Search news</span>
          <span className="news-explorer__input-wrap">
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search stories"
              type="search"
              value={search}
            />
          </span>
        </label>
        <label>
          <span>Category</span>
          <select
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {label(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Topic</span>
          <select onChange={(event) => setTag(event.target.value)} value={tag}>
            <option value="">All topics</option>
            {tags.map((item) => (
              <option key={item} value={item}>
                {label(item)}
              </option>
            ))}
          </select>
        </label>
        <strong aria-live="polite">
          {visible.length} news update{visible.length === 1 ? "" : "s"}
        </strong>
      </div>

      {featured ? (
        <LocaleLink
          className="news-feature"
          href={`/news/${featured.slug}`}
          locale={locale}
        >
          <div className="news-feature__media">
            {featured.heroMedia ? (
              <ResponsiveMediaImage
                alt={featured.title}
                media={featured.heroMedia}
                preload
                sizes="(max-width: 900px) 100vw, 58vw"
              />
            ) : (
              <span aria-hidden="true">M</span>
            )}
          </div>
          <div className="news-feature__copy">
            <div className="news-feature__meta">
              <span>{label(featured.category)}</span>
              <span>Featured story</span>
            </div>
            <h2>{featured.title}</h2>
            <p>{featured.excerpt}</p>
            <footer>
              <time dateTime={featured.publishedAt}>
                {date(featured.publishedAt, locale)}
              </time>
              <b>
                Read story <i aria-hidden="true">↗</i>
              </b>
            </footer>
          </div>
        </LocaleLink>
      ) : null}

      {remaining.length > 0 ? (
        <section className="news-latest" aria-labelledby="latest-news-heading">
          <header className="news-latest__header">
            <h2 id="latest-news-heading">Latest news</h2>
            <span>{remaining.length.toString().padStart(2, "0")} stories</span>
          </header>
          <div className="news-grid">
            {remaining.map((item) => (
              <LocaleLink
                className="news-card"
                href={`/news/${item.slug}`}
                key={item.id}
                locale={locale}
              >
                <div className="news-card__media">
                  {item.heroMedia ? (
                    <ResponsiveMediaImage
                      alt=""
                      media={item.heroMedia}
                      sizes="(max-width: 700px) 100vw, 33vw"
                    />
                  ) : (
                    <span aria-hidden="true">
                      {label(item.category).slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="news-card__copy">
                  <div className="news-card__meta">
                    <span>{label(item.category)}</span>
                    <time dateTime={item.publishedAt}>
                      {date(item.publishedAt, locale)}
                    </time>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.excerpt}</p>
                  <b>
                    Read story <i aria-hidden="true">↗</i>
                  </b>
                </div>
              </LocaleLink>
            ))}
          </div>
        </section>
      ) : null}

      {visible.length === 0 ? (
        <div className="news-empty">
          <strong>No news matches these filters</strong>
          <p>Try another category, topic, or search phrase.</p>
          <button
            onClick={() => {
              setSearch("");
              setCategory("");
              setTag("");
            }}
            type="button"
          >
            Reset filters
          </button>
        </div>
      ) : null}
    </div>
  );
}
