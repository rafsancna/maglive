"use client";

import {
  createNewsSlugBase,
  type AdminMediaDto,
  type LocaleCode,
  type NewsAdminDto,
  type NewsContentBlock,
} from "@maglive/contracts";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdminApiError } from "../auth/api";
import { useLanguages } from "../languages/LanguageProvider";
import { MediaPicker } from "../media/MediaPicker";
import { SelectedMediaSummary } from "../media/SelectedMediaSummary";
import { SeoEditor } from "../seo/SeoEditor";
import {
  archiveNews,
  createNews,
  deleteNews,
  listNews,
  publishNews,
  unpublishNews,
  updateNews,
} from "./api";
import { NewsWriter } from "./NewsWriter";
import { NewsTagInput } from "./NewsTagInput";

const categoryOptions = [
  "company-news",
  "product-news",
  "industry-news",
  "project-news",
  "innovation",
] as const;
type PickerTarget = {
  kind: "image" | "video" | "document";
  purpose: "hero" | "seo" | "block" | "writer";
  blockId?: string;
  onSelect?: (media: AdminMediaDto) => void;
};
function message(reason: unknown): string {
  return reason instanceof AdminApiError
    ? reason.message
    : reason instanceof Error
      ? reason.message
      : "The news operation failed.";
}
function categoryLabel(value: string): string {
  return value
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function emptyParagraph(): NewsContentBlock {
  return {
    id: crypto.randomUUID(),
    type: "paragraph",
    text: "Start writing your news here.",
  };
}
function newsFingerprint(news: NewsAdminDto): string {
  return JSON.stringify({
    slug: news.slug,
    category: news.category,
    authorName: news.authorName,
    featured: news.featured,
    tags: news.tags,
    heroMediaId: news.heroMediaId,
    translations: news.translations,
  });
}

export function LegacyNewsBlockEditor({
  blocks,
  onChange,
  chooseMedia,
}: {
  blocks: NewsContentBlock[];
  onChange: (blocks: NewsContentBlock[]) => void;
  chooseMedia: (target: PickerTarget) => void;
}) {
  const replace = (id: string, next: NewsContentBlock) =>
    onChange(blocks.map((block) => (block.id === id ? next : block)));
  const remove = (id: string) =>
    onChange(blocks.filter((block) => block.id !== id));
  const move = (index: number, delta: number) => {
    const next = [...blocks];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  };
  const add = (type: NewsContentBlock["type"]) => {
    const id = crypto.randomUUID();
    if (type === "paragraph")
      onChange([...blocks, { id, type, text: "New paragraph" }]);
    if (type === "heading")
      onChange([...blocks, { id, type, level: 2, text: "New section" }]);
    if (type === "quote")
      onChange([...blocks, { id, type, text: "Quotation" }]);
    if (type === "list")
      onChange([
        ...blocks,
        { id, type, style: "bulleted", items: ["List item"] },
      ]);
    if (type === "link")
      onChange([
        ...blocks,
        { id, type, label: "Visit link", url: "https://", newWindow: false },
      ]);
    if (type === "image" || type === "video" || type === "document")
      chooseMedia({ kind: type, purpose: "block", blockId: id });
  };
  return (
    <div className="news-block-editor">
      <div
        className="news-block-editor__toolbar"
        aria-label="Add news content block"
      >
        {(
          [
            "paragraph",
            "heading",
            "quote",
            "list",
            "image",
            "video",
            "document",
            "link",
          ] as const
        ).map((type) => (
          <button key={type} onClick={() => add(type)} type="button">
            + {categoryLabel(type)}
          </button>
        ))}
      </div>
      {blocks.map((block, index) => (
        <section className="news-block" key={block.id}>
          <header>
            <span>
              {String(index + 1).padStart(2, "0")} · {categoryLabel(block.type)}
            </span>
            <div>
              <button
                aria-label="Move block up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label="Move block down"
                disabled={index === blocks.length - 1}
                onClick={() => move(index, 1)}
                type="button"
              >
                ↓
              </button>
              <button onClick={() => remove(block.id)} type="button">
                Remove
              </button>
            </div>
          </header>
          {block.type === "paragraph" ? (
            <textarea
              aria-label="Paragraph"
              onChange={(event) =>
                replace(block.id, { ...block, text: event.target.value })
              }
              rows={6}
              value={block.text}
            />
          ) : null}
          {block.type === "heading" ? (
            <div className="news-block__row">
              <select
                aria-label="Heading level"
                onChange={(event) =>
                  replace(block.id, {
                    ...block,
                    level: Number(event.target.value) as 2 | 3,
                  })
                }
                value={block.level}
              >
                <option value="2">Heading 2</option>
                <option value="3">Heading 3</option>
              </select>
              <input
                aria-label="Heading text"
                onChange={(event) =>
                  replace(block.id, { ...block, text: event.target.value })
                }
                value={block.text}
              />
            </div>
          ) : null}
          {block.type === "quote" ? (
            <>
              <textarea
                aria-label="Quotation"
                onChange={(event) =>
                  replace(block.id, { ...block, text: event.target.value })
                }
                rows={4}
                value={block.text}
              />
              <input
                aria-label="Attribution"
                onChange={(event) =>
                  replace(block.id, {
                    ...block,
                    attribution: event.target.value || undefined,
                  })
                }
                placeholder="Attribution (optional)"
                value={block.attribution ?? ""}
              />
            </>
          ) : null}
          {block.type === "list" ? (
            <>
              <select
                aria-label="List style"
                onChange={(event) =>
                  replace(block.id, {
                    ...block,
                    style: event.target.value as "bulleted" | "numbered",
                  })
                }
                value={block.style}
              >
                <option value="bulleted">Bulleted</option>
                <option value="numbered">Numbered</option>
              </select>
              <textarea
                aria-label="List items"
                onChange={(event) =>
                  replace(block.id, {
                    ...block,
                    items: event.target.value.split("\n"),
                  })
                }
                rows={5}
                value={block.items.join("\n")}
              />
            </>
          ) : null}
          {block.type === "image" || block.type === "video" ? (
            <>
              <div className="news-block__media-id">
                <code>{block.mediaId}</code>
                <button
                  onClick={() =>
                    chooseMedia({
                      kind: block.type,
                      purpose: "block",
                      blockId: block.id,
                    })
                  }
                  type="button"
                >
                  Replace {block.type}
                </button>
              </div>
              <input
                aria-label="Alternative text"
                onChange={(event) =>
                  replace(block.id, {
                    ...block,
                    alt: event.target.value || undefined,
                  })
                }
                placeholder={
                  block.type === "image"
                    ? "Alternative text"
                    : "Accessible label"
                }
                value={block.alt ?? ""}
              />
              <textarea
                aria-label="Media caption"
                onChange={(event) =>
                  replace(block.id, {
                    ...block,
                    caption: event.target.value || undefined,
                  })
                }
                placeholder="Caption (optional)"
                rows={2}
                value={block.caption ?? ""}
              />
            </>
          ) : null}
          {block.type === "document" ? (
            <>
              <div className="news-block__media-id">
                <code>{block.mediaId}</code>
                <button
                  onClick={() =>
                    chooseMedia({
                      kind: "document",
                      purpose: "block",
                      blockId: block.id,
                    })
                  }
                  type="button"
                >
                  Replace document
                </button>
              </div>
              <input
                aria-label="Document link label"
                onChange={(event) =>
                  replace(block.id, { ...block, label: event.target.value })
                }
                value={block.label}
              />
              <textarea
                aria-label="Document description"
                onChange={(event) =>
                  replace(block.id, {
                    ...block,
                    description: event.target.value || undefined,
                  })
                }
                rows={2}
                value={block.description ?? ""}
              />
            </>
          ) : null}
          {block.type === "link" ? (
            <div className="news-block__link">
              <input
                aria-label="Link label"
                onChange={(event) =>
                  replace(block.id, { ...block, label: event.target.value })
                }
                value={block.label}
              />
              <input
                aria-label="Link URL"
                inputMode="url"
                onChange={(event) =>
                  replace(block.id, { ...block, url: event.target.value })
                }
                value={block.url}
              />
              <textarea
                aria-label="Link description"
                onChange={(event) =>
                  replace(block.id, {
                    ...block,
                    description: event.target.value || undefined,
                  })
                }
                rows={2}
                value={block.description ?? ""}
              />
              <label>
                <input
                  checked={block.newWindow}
                  onChange={(event) =>
                    replace(block.id, {
                      ...block,
                      newWindow: event.target.checked,
                    })
                  }
                  type="checkbox"
                />{" "}
                Open in a new window
              </label>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}

export function NewsWorkspace() {
  const { localeCodes, languageByCode } = useLanguages();
  const [items, setItems] = useState<NewsAdminDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<NewsAdminDto | null>(null);
  const [locale, setLocale] = useState<LocaleCode>("en");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [picker, setPicker] = useState<PickerTarget | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [savedFingerprint, setSavedFingerprint] = useState("");
  const savingRef = useRef(false);
  const translation = draft?.translations[locale];
  const refresh = async (keepId?: string) => {
    setLoading(true);
    try {
      const result = await listNews({
        page: 1,
        limit: 100,
        ...(search ? { search } : {}),
        ...(status ? { status: status as NewsAdminDto["status"] } : {}),
      });
      setItems(result.items);
      const id = keepId ?? selectedId ?? result.items[0]?.id ?? null;
      const selected = result.items.find((item) => item.id === id) ?? null;
      setSelectedId(id);
      setDraft(selected);
      setSavedFingerprint(selected === null ? "" : newsFingerprint(selected));
      setError(null);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    let active = true;
    void listNews({
      page: 1,
      limit: 100,
      ...(search ? { search } : {}),
      ...(status ? { status: status as NewsAdminDto["status"] } : {}),
    })
      .then((result) => {
        if (!active) return;
        const first = result.items[0] ?? null;
        setItems(result.items);
        setSelectedId(first?.id ?? null);
        setDraft(first);
        setSavedFingerprint(first === null ? "" : newsFingerprint(first));
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(message(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [search, status]);
  const setTranslation = (
    next: NonNullable<NewsAdminDto["translations"][string]>,
  ) => {
    if (draft)
      setDraft({
        ...draft,
        translations: { ...draft.translations, [locale]: next },
      });
  };
  const ensureTranslation = () => {
    if (!draft) return;
    setDraft({
      ...draft,
      translations: {
        ...draft.translations,
        [locale]: {
          title: "",
          excerpt: "",
          content: [emptyParagraph()],
          seo: { keywords: [] },
        },
      },
    });
  };
  const selectMedia = (media: AdminMediaDto) => {
    if (!draft || !picker) return;
    if (picker.purpose === "writer") picker.onSelect?.(media);
    else if (picker.purpose === "hero")
      setDraft({ ...draft, heroMediaId: media.id });
    else if (picker.purpose === "seo" && translation)
      setTranslation({
        ...translation,
        seo: { ...translation.seo, openGraphMediaId: media.id },
      });
    else if (translation && picker.blockId) {
      const block: NewsContentBlock =
        media.kind === "document"
          ? {
              id: picker.blockId,
              type: "document",
              mediaId: media.id,
              label: media.originalName,
            }
          : {
              id: picker.blockId,
              type: media.kind as "image" | "video",
              mediaId: media.id,
            };
      const exists = translation.content.some(
        (candidate) => candidate.id === picker.blockId,
      );
      setTranslation({
        ...translation,
        content: exists
          ? translation.content.map((candidate) =>
              candidate.id === picker.blockId ? block : candidate,
            )
          : [...translation.content, block],
      });
    }
    setPicker(null);
  };
  const persistNews = useCallback(
    async (
      candidate: NewsAdminDto,
      automatic: boolean,
    ): Promise<NewsAdminDto | null> => {
      if (savingRef.current) return null;
      savingRef.current = true;
      setBusy(true);
      setError(null);
      const candidateFingerprint = newsFingerprint(candidate);
      try {
        const updated = await updateNews(candidate.id, {
          version: candidate.version,
          slug: candidate.slug,
          category: candidate.category,
          authorName: candidate.authorName,
          featured: candidate.featured,
          tags: candidate.tags,
          heroMediaId: candidate.heroMediaId ?? null,
          translations: candidate.translations,
        });
        setItems((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        setDraft((current) => {
          if (current?.id !== updated.id) return current;
          if (newsFingerprint(current) === candidateFingerprint) return updated;
          return {
            ...current,
            version: updated.version,
            status: updated.status,
            localeStates: updated.localeStates,
            updatedAt: updated.updatedAt,
            updatedBy: updated.updatedBy,
          };
        });
        setSavedFingerprint(newsFingerprint(updated));
        if (!automatic) setNotice("News changes saved as a working draft.");
        return updated;
      } catch (reason) {
        setError(message(reason));
        return null;
      } finally {
        savingRef.current = false;
        setBusy(false);
      }
    },
    [],
  );
  const save = async () => {
    if (draft) await persistNews(draft, false);
  };
  const currentFingerprint = draft === null ? "" : newsFingerprint(draft);
  const isDirty =
    draft !== null &&
    savedFingerprint !== "" &&
    currentFingerprint !== savedFingerprint;
  useEffect(() => {
    if (draft === null || !isDirty || busy || picker !== null) return;
    const timer = window.setTimeout(() => {
      void persistNews(draft, true);
    }, 2_500);
    return () => window.clearTimeout(timer);
  }, [busy, draft, isDirty, persistNews, picker]);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createNews({
        slug: createNewsSlugBase(newTitle),
        category: "company-news",
        authorName: newAuthor,
        featured: false,
        tags: [],
        translations: {
          en: {
            title: newTitle,
            excerpt: "Add a concise news summary.",
            content: [emptyParagraph()],
            seo: { keywords: [] },
          },
        },
      });
      setCreating(false);
      setNewTitle("");
      setNewAuthor("");
      await refresh(created.id);
      setNotice("News draft created.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    if (!draft || !translation) return;
    const publishable = isDirty ? await persistNews(draft, true) : draft;
    if (publishable === null) return;
    setBusy(true);
    try {
      const updated = await publishNews(publishable.id, {
        version: publishable.version,
        locales: [locale],
      });
      setDraft(updated);
      setSavedFingerprint(newsFingerprint(updated));
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice(`${languageByCode[locale]?.label ?? locale} news published.`);
      setError(null);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };
  const unpublish = async () => {
    if (!draft) return;
    setBusy(true);
    try {
      const updated = await unpublishNews(draft.id, {
        version: draft.version,
        locale,
      });
      setDraft(updated);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setNotice("Language unpublished.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };
  const archive = async () => {
    if (
      !draft ||
      !confirm("Archive this news item and remove it from the public website?")
    )
      return;
    setBusy(true);
    try {
      const updated = await archiveNews(draft.id, draft.version);
      setDraft(updated);
      await refresh(updated.id);
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!draft || !confirm("Permanently delete this unpublished news item?"))
      return;
    setBusy(true);
    try {
      await deleteNews(draft.id, draft.version);
      setSelectedId(null);
      await refresh();
      setNotice("News item deleted.");
    } catch (reason) {
      setError(message(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`news-admin${focusMode ? " news-admin--focus" : ""}`}>
      <header className="news-admin__header">
        <div>
          <span className="admin-kicker">Editorial newsroom</span>
          <h1>News</h1>
          <p>
            Create, localize, optimize, and publish company news with reusable
            media and documents.
          </p>
        </div>
        <button
          className="admin-button admin-button--primary"
          onClick={() => setCreating(true)}
          type="button"
        >
          Create news
        </button>
      </header>
      {error ? (
        <div className="admin-alert" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="admin-notice" role="status">
          {notice}
        </div>
      ) : null}
      {creating ? (
        <form
          className="news-create"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <h2>New news draft</h2>
          <label className="admin-field">
            <span>English title</span>
            <input
              autoFocus
              maxLength={180}
              onChange={(event) => setNewTitle(event.target.value)}
              required
              value={newTitle}
            />
          </label>
          <label className="admin-field">
            <span>Author / newsroom</span>
            <input
              maxLength={120}
              onChange={(event) => setNewAuthor(event.target.value)}
              required
              value={newAuthor}
            />
          </label>
          <div>
            <button
              className="admin-button admin-button--primary"
              disabled={busy}
              type="submit"
            >
              Create draft
            </button>
            <button
              className="admin-button admin-button--quiet"
              onClick={() => setCreating(false)}
              type="button"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : null}
      <div className="news-admin__layout">
        <aside className="news-list">
          <div className="news-list__filters">
            <input
              aria-label="Search news"
              onChange={(event) => {
                setLoading(true);
                setSearch(event.target.value);
              }}
              placeholder="Search news"
              type="search"
              value={search}
            />
            <select
              aria-label="Filter news status"
              onChange={(event) => {
                setLoading(true);
                setStatus(event.target.value);
              }}
              value={status}
            >
              <option value="">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          {loading ? (
            <p>Loading news…</p>
          ) : (
            items.map((item) => (
              <button
                aria-current={item.id === selectedId ? "true" : undefined}
                key={item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setDraft(item);
                  setSavedFingerprint(newsFingerprint(item));
                }}
                type="button"
              >
                <span>{item.translations.en?.title ?? item.slug}</span>
                <small>
                  {item.status} · {categoryLabel(item.category)}
                </small>
              </button>
            ))
          )}
        </aside>
        {draft === null ? (
          <div className="news-editor-empty">
            <h2>Select or create news</h2>
            <p>Your multilingual newsroom will appear here.</p>
          </div>
        ) : (
          <main className="news-editor">
            <header className="news-editor__top">
              <div>
                <span className={`news-status news-status--${draft.status}`}>
                  {draft.status}
                </span>
                <strong>
                  {draft.localeStates[locale]?.replaceAll("-", " ") ??
                    "incomplete"}
                </strong>
                <span
                  aria-live="polite"
                  className={`news-save-state${isDirty ? " news-save-state--dirty" : ""}`}
                >
                  {busy
                    ? "Saving…"
                    : isDirty
                      ? "Unsaved changes · autosaves shortly"
                      : "All changes saved"}
                </span>
              </div>
              <div>
                <button
                  className="admin-button admin-button--quiet"
                  onClick={() => setFocusMode((current) => !current)}
                  type="button"
                >
                  {focusMode ? "Exit focus" : "Focus mode"}
                </button>
                <button
                  className="admin-button admin-button--quiet"
                  disabled={busy || !isDirty}
                  onClick={() => void save()}
                  type="button"
                >
                  Save now
                </button>
                {translation ? (
                  <button
                    className="admin-button admin-button--primary"
                    disabled={busy}
                    onClick={() => void publish()}
                    type="button"
                  >
                    Publish {locale.toUpperCase()}
                  </button>
                ) : null}
                {draft.publishedSnapshots[locale] ? (
                  <button
                    className="admin-button admin-button--quiet"
                    disabled={busy}
                    onClick={() => void unpublish()}
                    type="button"
                  >
                    Unpublish
                  </button>
                ) : null}
                {draft.publishedSnapshots[locale] ? (
                  <Link
                    className="admin-button admin-button--quiet"
                    href={`/${locale}/news/${draft.publishedGlobal?.slug ?? draft.slug}`}
                    target="_blank"
                  >
                    View live
                  </Link>
                ) : null}
              </div>
            </header>
            <nav aria-label="News languages" className="news-locale-tabs">
              {localeCodes.map((code) => (
                <button
                  aria-current={locale === code ? "page" : undefined}
                  key={code}
                  onClick={() => setLocale(code)}
                  type="button"
                >
                  <span>{languageByCode[code]?.nativeLabel ?? code}</span>
                  <small>{draft.localeStates[code] ?? "incomplete"}</small>
                </button>
              ))}
            </nav>
            <section className="news-editor__section">
              <h2>News settings</h2>
              <div className="product-editor__grid">
                <label className="admin-field">
                  <span>URL slug</span>
                  <input
                    onChange={(event) =>
                      setDraft({ ...draft, slug: event.target.value })
                    }
                    value={draft.slug}
                  />
                </label>
                <label className="admin-field">
                  <span>Category</span>
                  <input
                    list="news-categories"
                    onChange={(event) =>
                      setDraft({ ...draft, category: event.target.value })
                    }
                    value={draft.category}
                  />
                  <datalist id="news-categories">
                    {categoryOptions.map((option) => (
                      <option key={option} value={option} />
                    ))}
                  </datalist>
                </label>
                <label className="admin-field">
                  <span>Author / newsroom</span>
                  <input
                    onChange={(event) =>
                      setDraft({ ...draft, authorName: event.target.value })
                    }
                    value={draft.authorName}
                  />
                </label>
                <label className="admin-check">
                  <input
                    checked={draft.featured}
                    onChange={(event) =>
                      setDraft({ ...draft, featured: event.target.checked })
                    }
                    type="checkbox"
                  />{" "}
                  Feature this news
                </label>
                <div className="admin-field">
                  <span>Hero image</span>
                  <div className="news-media-control">
                    {draft.heroMediaId === undefined ? (
                      <div className="selected-media-summary selected-media-summary--empty">
                        <div className="selected-media-summary__placeholder" aria-hidden="true">IMG</div>
                        <div><strong>No hero image selected</strong><span>Choose a reusable image from the media library.</span></div>
                      </div>
                    ) : (
                      <SelectedMediaSummary mediaId={draft.heroMediaId} />
                    )}
                    <button
                      onClick={() =>
                        setPicker({ kind: "image", purpose: "hero" })
                      }
                      type="button"
                    >
                      Choose image
                    </button>
                    {draft.heroMediaId ? (
                      <button
                        onClick={() =>
                          setDraft({ ...draft, heroMediaId: undefined })
                        }
                        type="button"
                      >
                        Clear
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>
            {translation === undefined ? (
              <section className="news-editor__section news-translation-empty">
                <h2>{languageByCode[locale]?.label ?? locale} content</h2>
                <p>
                  Create this translation, then write and publish it
                  independently.
                </p>
                <button
                  className="admin-button admin-button--primary"
                  onClick={ensureTranslation}
                  type="button"
                >
                  Create {locale.toUpperCase()} translation
                </button>
              </section>
            ) : (
              <>
                <section className="news-editor__section news-editor__section--story">
                  <h2>{languageByCode[locale]?.label ?? locale} story</h2>
                  <label className="admin-field news-writer__title-field">
                    <span>News headline</span>
                    <input
                      maxLength={180}
                      onChange={(event) =>
                        setTranslation({
                          ...translation,
                          title: event.target.value,
                        })
                      }
                      placeholder="Write a clear, compelling headline"
                      value={translation.title}
                    />
                  </label>
                  <label className="admin-field news-writer__excerpt-field">
                    <span>Summary / standfirst</span>
                    <textarea
                      maxLength={500}
                      onChange={(event) =>
                        setTranslation({
                          ...translation,
                          excerpt: event.target.value,
                        })
                      }
                      placeholder="Summarize the most important news in one or two sentences"
                      rows={3}
                      value={translation.excerpt}
                    />
                    <small>{translation.excerpt.length}/500 characters</small>
                  </label>
                  <NewsWriter
                    blocks={translation.content}
                    locale={locale}
                    onChooseMedia={(kind, onSelect) =>
                      setPicker({ kind, purpose: "writer", onSelect })
                    }
                    onChange={(content) =>
                      setTranslation({ ...translation, content })
                    }
                  />
                  <NewsTagInput
                    key={`${draft.id}-${locale}`}
                    onChange={(tags) => setDraft({ ...draft, tags })}
                    tags={draft.tags}
                  />
                </section>
                <section className="news-editor__section">
                  <div className="news-editor__section-heading">
                    <div>
                      <h2>Full SEO</h2>
                      <p>
                        Search, canonical, robots, Open Graph, and social
                        sharing controls for this language.
                      </p>
                    </div>
                  </div>
                  <SeoEditor
                    onChooseOpenGraphMedia={() =>
                      setPicker({ kind: "image", purpose: "seo" })
                    }
                    onClearOpenGraphMedia={() =>
                      setTranslation({
                        ...translation,
                        seo: {
                          ...translation.seo,
                          openGraphMediaId: undefined,
                        },
                      })
                    }
                    onChange={(seo) =>
                      setTranslation({
                        ...translation,
                        seo: { ...seo, keywords: seo.keywords ?? [] },
                      })
                    }
                    value={translation.seo}
                  />
                </section>
              </>
            )}
            <footer className="news-editor__danger">
              <button
                disabled={busy}
                onClick={() => void archive()}
                type="button"
              >
                Archive news
              </button>
              <button
                disabled={busy || draft.status === "published"}
                onClick={() => void remove()}
                type="button"
              >
                Delete permanently
              </button>
            </footer>
          </main>
        )}
      </div>
      {picker ? (
        <MediaPicker
          kind={picker.kind}
          onClose={() => setPicker(null)}
          onSelect={selectMedia}
          {...((picker.purpose === "hero"
            ? draft?.heroMediaId
            : picker.purpose === "seo"
              ? translation?.seo.openGraphMediaId
              : undefined) === undefined
            ? {}
            : {
                selectedId:
                  picker.purpose === "hero"
                    ? draft!.heroMediaId!
                    : translation!.seo.openGraphMediaId!,
              })}
          title={
            picker.purpose === "hero"
              ? "Choose news hero image"
              : picker.purpose === "seo"
                ? "Choose social sharing image"
                : `Choose ${picker.kind}`
          }
        />
      ) : null}
    </section>
  );
}
