"use client";

import type { NavigationAdminDto, NewsAdminDto } from "@maglive/contracts";
import { useEffect, useMemo, useState } from "react";
import { listNews } from "../news/api";

type Props = Readonly<{
  data: NavigationAdminDto;
  onChange: (next: NavigationAdminDto) => void;
}>;

function articleTitle(article: NewsAdminDto): string {
  return article.publishedSnapshots.en?.data.title
    ?? Object.values(article.publishedSnapshots)[0]?.data.title
    ?? article.slug;
}

function articleExcerpt(article: NewsAdminDto): string {
  return article.publishedSnapshots.en?.data.excerpt
    ?? Object.values(article.publishedSnapshots)[0]?.data.excerpt
    ?? "";
}

function publishedDate(article: NewsAdminDto): string {
  const value = article.firstPublishedAt ?? article.publishedGlobal?.publishedAt;
  if (value === undefined) return "Published";
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function move(ids: readonly string[], index: number, direction: -1 | 1): string[] {
  const destination = index + direction;
  if (destination < 0 || destination >= ids.length) return [...ids];
  const next = [...ids];
  [next[index], next[destination]] = [next[destination]!, next[index]!];
  return next;
}

export function NewsSelectionEditor({ data, onChange }: Props) {
  const [articles, setArticles] = useState<readonly NewsAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const selectedIds = data.newsArticleIds ?? [];
  const itemCount = data.newsItemCount ?? 4;

  useEffect(() => {
    let active = true;
    void listNews({ status: "published", page: 1, limit: 100 })
      .then((result) => { if (active) setArticles(result.items); })
      .catch(() => { if (active) setLoadError("Published news could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const articleById = useMemo(
    () => new Map(articles.map((article) => [article.id, article])),
    [articles],
  );
  const available = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query === "") return articles;
    return articles.filter((article) =>
      [articleTitle(article), article.slug, article.category]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [articles, search]);
  const selectionComplete = selectedIds.length === 0 || selectedIds.length === itemCount;

  function setCount(count: 3 | 4): void {
    onChange({
      ...data,
      newsItemCount: count,
      newsArticleIds: selectedIds.length > count ? selectedIds.slice(0, count) : selectedIds,
      news: [],
    });
  }

  function toggle(id: string): void {
    const isSelected = selectedIds.includes(id);
    if (!isSelected && selectedIds.length >= itemCount) return;
    onChange({
      ...data,
      newsArticleIds: isSelected ? selectedIds.filter((value) => value !== id) : [...selectedIds, id],
      news: [],
    });
  }

  return (
    <div className="admin-navigation__content admin-news-selection">
      <header className="admin-navigation__section-header">
        <div>
          <span className="admin-kicker">News menu</span>
          <h2>Choose the stories visitors see</h2>
          <p>Select 3 or 4 published articles. Leave the selection empty to keep the menu automatically updated with the latest news.</p>
        </div>
      </header>

      <section className="admin-news-selection__settings" aria-label="News menu behavior">
        <div>
          <span className="admin-news-selection__label">Stories shown</span>
          <div className="admin-news-selection__count" role="group" aria-label="Number of news stories">
            {([3, 4] as const).map((count) => (
              <button aria-pressed={itemCount === count} className={itemCount === count ? "is-active" : ""} key={count} onClick={() => setCount(count)} type="button">{count}</button>
            ))}
          </div>
        </div>
        <div className={`admin-news-selection__mode ${selectedIds.length === 0 ? "is-automatic" : "is-curated"}`}>
          <span aria-hidden="true">{selectedIds.length === 0 ? "↻" : "✓"}</span>
          <div><strong>{selectedIds.length === 0 ? "Latest news — automatic" : "Curated selection"}</strong><small>{selectedIds.length === 0 ? `The newest ${itemCount} published articles will appear automatically.` : selectionComplete ? `${selectedIds.length} articles selected and ready to save.` : `Select ${itemCount - selectedIds.length} more ${itemCount - selectedIds.length === 1 ? "article" : "articles"}.`}</small></div>
          {selectedIds.length > 0 ? <button className="admin-button admin-button--quiet" onClick={() => onChange({ ...data, newsArticleIds: [], news: [] })} type="button">Use latest instead</button> : null}
        </div>
      </section>

      {selectedIds.length > 0 ? (
        <section className="admin-news-selection__selected" aria-labelledby="selected-news-heading">
          <div className="admin-news-selection__subhead"><div><span className="admin-kicker">Menu order</span><h3 id="selected-news-heading">Selected stories</h3></div><span>{selectedIds.length} / {itemCount}</span></div>
          <div className="admin-news-selection__selected-list">
            {selectedIds.map((id, index) => {
              const article = articleById.get(id);
              return <article className="admin-news-selection__selected-card" key={id}><span className="admin-news-selection__position">{String(index + 1).padStart(2, "0")}</span><div><small>{index === 0 ? "Lead story" : `Story ${index + 1}`}</small><strong>{article === undefined ? "Loading selected article…" : articleTitle(article)}</strong>{article ? <span>{article.category.replaceAll("-", " ")} · {publishedDate(article)}</span> : null}</div><div className="admin-news-selection__order"><button aria-label={`Move ${article === undefined ? "article" : articleTitle(article)} up`} disabled={index === 0} onClick={() => onChange({ ...data, newsArticleIds: move(selectedIds, index, -1), news: [] })} type="button">↑</button><button aria-label={`Move ${article === undefined ? "article" : articleTitle(article)} down`} disabled={index === selectedIds.length - 1} onClick={() => onChange({ ...data, newsArticleIds: move(selectedIds, index, 1), news: [] })} type="button">↓</button><button aria-label={`Remove ${article === undefined ? "article" : articleTitle(article)}`} className="is-remove" onClick={() => toggle(id)} type="button">×</button></div></article>;
            })}
          </div>
        </section>
      ) : null}

      <section className="admin-news-selection__library" aria-labelledby="published-news-heading">
        <div className="admin-news-selection__library-head"><div><span className="admin-kicker">News database</span><h3 id="published-news-heading">Published articles</h3></div><label><span className="sr-only">Search published news</span><input onChange={(event) => setSearch(event.target.value)} placeholder="Search title, slug or category…" type="search" value={search} /></label></div>
        {loadError ? <div className="admin-alert" role="alert">{loadError}</div> : null}
        {loading ? <div className="admin-navigation__loading">Loading published news…</div> : null}
        {!loading && available.length === 0 ? <div className="admin-news-selection__empty"><strong>No published news found</strong><span>Publish articles in News, then return here to curate this menu.</span></div> : null}
        <div className="admin-news-selection__grid">
          {available.map((article) => {
            const selectedIndex = selectedIds.indexOf(article.id);
            const selected = selectedIndex >= 0;
            const disabled = !selected && selectedIds.length >= itemCount;
            return <button aria-pressed={selected} className={selected ? "is-selected" : ""} disabled={disabled} key={article.id} onClick={() => toggle(article.id)} type="button"><span className="admin-news-selection__card-top"><small>{article.category.replaceAll("-", " ")}</small><span>{selected ? String(selectedIndex + 1).padStart(2, "0") : "+"}</span></span><strong>{articleTitle(article)}</strong><span className="admin-news-selection__excerpt">{articleExcerpt(article)}</span><span className="admin-news-selection__meta">{publishedDate(article)} · {Object.keys(article.publishedSnapshots).map((locale) => locale.toUpperCase()).join(" / ")}</span></button>;
          })}
        </div>
      </section>
      {!selectionComplete ? <p className="admin-news-selection__validation" role="status">Complete the selection before saving, or choose “Use latest instead”.</p> : null}
    </div>
  );
}
