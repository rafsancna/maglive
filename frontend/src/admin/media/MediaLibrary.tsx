"use client";

import {
  type AdminMediaDto,
  type LocaleCode,
  type MediaKind,
  type MediaUsageDto,
  type MediaUsageOwnerType,
} from "@maglive/contracts";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AdminApiError } from "../auth/api";
import {
  deleteMedia,
  getMediaUsages,
  listMedia,
  updateMedia,
  uploadMedia,
} from "./api";
import { MediaPicker } from "./MediaPicker";
import { MediaPreview } from "./MediaPreview";
import { useLanguages } from "../languages/LanguageProvider";

type TranslationFields = {
  title: string;
  alt: string;
  caption: string;
};

const emptyTranslation: TranslationFields = {
  title: "",
  alt: "",
  caption: "",
};

type MediaCategory = MediaKind | "";

const MEDIA_CATEGORIES: readonly {
  value: MediaCategory;
  label: string;
  description: string;
  marker: string;
}[] = [
  { value: "", label: "All media", description: "Every reusable asset", marker: "ALL" },
  { value: "image", label: "Photos", description: "JPG, PNG and WebP", marker: "IMG" },
  { value: "video", label: "Videos", description: "MP4 and WebM", marker: "VID" },
  { value: "document", label: "Documents", description: "PDF downloads", marker: "PDF" },
];

const OWNER_TYPE_LABELS: Record<MediaUsageOwnerType, string> = {
  product: "Products",
  category: "Categories",
  news: "News",
  story: "Stories",
  blog: "Blogs",
  page: "Pages",
  media: "Media",
  other: "Other",
};

function translationFor(
  media: AdminMediaDto,
  locale: LocaleCode,
): TranslationFields {
  const translation = media.defaultTranslations[locale];
  return {
    title: translation?.title ?? "",
    alt: translation?.alt ?? "",
    caption: translation?.caption ?? "",
  };
}

function mediaError(reason: unknown): string {
  if (!(reason instanceof AdminApiError)) {
    return "The media operation failed unexpectedly.";
  }
  switch (reason.code) {
    case "MEDIA_IN_USE":
      return "This asset is still referenced. Review and remove every usage first.";
    case "MEDIA_CLEANUP_FAILED":
      return "Storage cleanup failed safely. Refresh the asset and retry deletion.";
    case "VERSION_CONFLICT":
      return "This media record changed elsewhere. Refresh and try again.";
    case "API_UNAVAILABLE":
      return "The CMS API is unavailable. You can retry without selecting the file again.";
    case "UPLOAD_ABORTED":
      return "Upload cancelled. The selected file is ready to retry.";
    default:
      return reason.message;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function usageLabel(usage: MediaUsageDto): string {
  return `${usage.ownerLabel} · ${usage.kind.replaceAll("-", " ")}${usage.locale === undefined ? "" : ` · ${usage.locale}`}`;
}

function usageOwnerType(usage: MediaUsageDto): MediaUsageOwnerType {
  if (usage.ownerType !== undefined) return usage.ownerType;
  if (usage.kind.startsWith("product-")) return "product";
  if (usage.kind.startsWith("category-")) return "category";
  if (usage.kind === "media-poster") return "media";
  return "other";
}

function usagePlacement(usage: MediaUsageDto): string {
  if (usage.placement !== undefined) return usage.placement;
  if (usage.kind.includes("feature-icon")) return "Feature icon";
  if (usage.kind.includes("seo")) return "Open Graph image";
  if (usage.kind.includes("category") && usage.kind.includes("image")) {
    return "Category image";
  }
  if (usage.kind === "media-poster") return "Video poster";
  return "Product media";
}

function usageStage(usage: MediaUsageDto): string {
  if (usage.kind.includes("published")) return "Published";
  if (usage.kind === "media-poster") return "Media relationship";
  return "Working draft";
}

function usageHref(usage: MediaUsageDto): string | undefined {
  const ownerType = usageOwnerType(usage);
  if (ownerType === "product") return `/admin/products/${usage.ownerId}`;
  if (ownerType === "category") return "/admin/categories";
  return undefined;
}

export function MediaLibrary() {
  const { localeCodes, languageByCode } = useLanguages();
  const [items, setItems] = useState<AdminMediaDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [kind, setKind] = useState<MediaCategory>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [locale, setLocale] = useState<LocaleCode>("en");
  const [translation, setTranslation] =
    useState<TranslationFields>(emptyTranslation);
  const [usageResult, setUsageResult] = useState<{
    mediaId: string;
    usages: MediaUsageDto[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [posterPickerOpen, setPosterPickerOpen] = useState(false);
  const uploadAbort = useRef<AbortController | null>(null);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId),
    [items, selectedId],
  );
  const usages = useMemo(
    () =>
      selected !== undefined && usageResult?.mediaId === selected.id
        ? usageResult.usages
        : [],
    [selected, usageResult],
  );
  const usagesLoading =
    selected !== undefined && usageResult?.mediaId !== selected.id;

  useEffect(() => {
    let active = true;
    void listMedia({
      page,
      limit: 12,
      ...(kind === "" ? {} : { kind }),
      ...(search.trim() === "" ? {} : { search: search.trim() }),
    })
      .then((result) => {
        if (!active) return;
        setItems(result.items);
        setTotalPages(result.pagination.totalPages);
        setTotalResults(result.pagination.total);
        setSelectedId((current) => {
          if (result.items.some((item) => item.id === current)) return current;
          const first = result.items[0];
          if (first !== undefined) setTranslation(translationFor(first, locale));
          return first?.id ?? null;
        });
        setError(null);
      })
      .catch((reason: unknown) => {
        if (active) setError(mediaError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, locale, page, search]);

  useEffect(() => {
    if (selected === undefined) return;
    let active = true;
    void getMediaUsages(selected.id)
      .then((result) => {
        if (active) {
          setUsageResult({ mediaId: selected.id, usages: result.usages });
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setUsageResult({ mediaId: selected.id, usages: [] });
          setError(mediaError(reason));
        }
      });
    return () => {
      active = false;
    };
  }, [selected]);

  const usageGroups = useMemo(() => {
    const groups = new Map<MediaUsageOwnerType, MediaUsageDto[]>();
    for (const usage of usages) {
      const ownerType = usageOwnerType(usage);
      groups.set(ownerType, [...(groups.get(ownerType) ?? []), usage]);
    }
    return [...groups.entries()];
  }, [usages]);

  function replaceItem(media: AdminMediaDto): void {
    setItems((current) =>
      current.map((item) => (item.id === media.id ? media : item)),
    );
    setSelectedId(media.id);
    setTranslation(translationFor(media, locale));
  }

  async function performUpload(
    file: File,
    replacement = false,
  ): Promise<void> {
    const controller = new AbortController();
    uploadAbort.current = controller;
    setUploading(true);
    setLastFile(file);
    setUploadProgress(0);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const uploaded = await uploadMedia(
        file,
        setUploadProgress,
        controller.signal,
      );
      setItems((current) => [uploaded, ...current]);
      setSelectedId(uploaded.id);
      setTranslation(translationFor(uploaded, locale));
      setUploadProgress(100);
      setLastFile(null);
      setNotice(
        replacement
          ? "Replacement uploaded as a new immutable asset. Update each desired reference explicitly; the old asset remains intact."
          : "Media uploaded and ready.",
      );
    } catch (reason) {
      setError(mediaError(reason));
    } finally {
      uploadAbort.current = null;
      setUploading(false);
      setBusy(false);
    }
  }

  async function saveMetadata(): Promise<void> {
    if (selected === undefined) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await updateMedia(selected.id, {
        version: selected.version,
        defaultTranslations: {
          ...selected.defaultTranslations,
          [locale]: {
            ...(translation.title.trim() === ""
              ? {}
              : { title: translation.title.trim() }),
            ...(translation.alt.trim() === ""
              ? {}
              : { alt: translation.alt.trim() }),
            ...(translation.caption.trim() === ""
              ? {}
              : { caption: translation.caption.trim() }),
          },
        },
      });
      replaceItem(updated);
      setNotice("Reusable metadata saved.");
    } catch (reason) {
      setError(mediaError(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected(): Promise<void> {
    if (
      selected === undefined ||
      usages.length > 0 ||
      !window.confirm("Permanently delete this unreferenced media asset?")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteMedia(selected.id, selected.version);
      const remaining = items.filter((item) => item.id !== selected.id);
      setItems(remaining);
      const next = remaining[0];
      setSelectedId(next?.id ?? null);
      setTranslation(
        next === undefined ? emptyTranslation : translationFor(next, locale),
      );
      setNotice("Media and its stored object were deleted.");
    } catch (reason) {
      setError(mediaError(reason));
      if (reason instanceof AdminApiError && reason.code === "MEDIA_IN_USE") {
        void getMediaUsages(selected.id).then((result) =>
          setUsageResult({ mediaId: selected.id, usages: result.usages }),
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function selectPoster(poster: AdminMediaDto): Promise<void> {
    if (selected === undefined) return;
    setPosterPickerOpen(false);
    setBusy(true);
    setError(null);
    try {
      const updated = await updateMedia(selected.id, {
        version: selected.version,
        posterMediaId: poster.id,
      });
      replaceItem(updated);
      setNotice("Video poster updated.");
    } catch (reason) {
      setError(mediaError(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="media-library">
      <header className="media-library__header">
        <div>
          <span className="admin-kicker">Asset operations</span>
          <h1>Media library</h1>
          <p>
            Upload validated images, videos, and PDFs; reuse them safely across
            localized content.
          </p>
        </div>
        <label className="admin-button admin-button--primary media-upload-button">
          <span>Upload media</span>
          <input
            accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file !== undefined) void performUpload(file);
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      </header>

      {uploadProgress === null ? null : (
        <div className="media-upload-progress">
          <div>
            <strong>Upload progress</strong>
            <span>{uploadProgress}%</span>
          </div>
          <progress max="100" value={uploadProgress}>
            {uploadProgress}%
          </progress>
          {uploading ? (
            <button onClick={() => uploadAbort.current?.abort()} type="button">
              Cancel upload
            </button>
          ) : null}
          {!busy && lastFile !== null ? (
            <button onClick={() => void performUpload(lastFile)} type="button">
              Retry upload
            </button>
          ) : null}
        </div>
      )}
      {error === null ? null : (
        <div className="admin-alert" role="alert">
          {error}
        </div>
      )}
      {notice === null ? null : (
        <div className="admin-notice" role="status">
          {notice}
        </div>
      )}

      <nav aria-label="Media categories" className="media-categories">
        {MEDIA_CATEGORIES.map((category) => (
          <button
            aria-current={kind === category.value ? "page" : undefined}
            key={category.value || "all"}
            onClick={() => {
              setLoading(true);
              setKind(category.value);
              setPage(1);
            }}
            type="button"
          >
            <span aria-hidden="true">{category.marker}</span>
            <div>
              <strong>{category.label}</strong>
              <small>{category.description}</small>
            </div>
            {kind === category.value ? <b>{totalResults}</b> : null}
          </button>
        ))}
      </nav>

      <div className="media-toolbar">
        <label className="admin-field">
          <span>Search media</span>
          <input
            onChange={(event) => {
              setLoading(true);
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by original filename"
            type="search"
            value={search}
          />
        </label>
        <div className="media-toolbar__summary" aria-live="polite">
          <strong>{totalResults}</strong>
          <span>{totalResults === 1 ? "asset" : "assets"} in this category</span>
        </div>
      </div>

      {loading ? <p aria-live="polite">Loading media library…</p> : null}
      {!loading && items.length === 0 ? (
        <div className="media-empty">
          <strong>No media found</strong>
          <p>Upload an approved asset or change the current filters.</p>
        </div>
      ) : null}

      <div className="media-library__layout">
        <div>
          <div className="media-grid" aria-label="Media results">
            {items.map((media) => (
              <button
                aria-current={media.id === selectedId ? "true" : undefined}
                key={media.id}
                onClick={() => {
                  setSelectedId(media.id);
                  setTranslation(translationFor(media, locale));
                }}
                type="button"
              >
                <MediaPreview compact media={media} />
                <span>{media.originalName}</span>
                <small>
                  {media.kind} · {formatBytes(media.sizeBytes)}
                </small>
              </button>
            ))}
          </div>
          <nav aria-label="Media pages" className="media-pagination">
            <button
              disabled={page <= 1}
              onClick={() => {
                setLoading(true);
                setPage((current) => current - 1);
              }}
              type="button"
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.max(totalPages, 1)}
            </span>
            <button
              disabled={totalPages === 0 || page >= totalPages}
              onClick={() => {
                setLoading(true);
                setPage((current) => current + 1);
              }}
              type="button"
            >
              Next
            </button>
          </nav>
        </div>

        {selected === undefined ? null : (
          <aside className="media-inspector">
            <MediaPreview media={selected} />
            <div className="media-inspector__identity">
              <span className="admin-kicker">{selected.kind}</span>
              <h2>{selected.originalName}</h2>
              <p>
                {formatBytes(selected.sizeBytes)}
                {selected.width === undefined
                  ? ""
                  : ` · ${selected.width} × ${selected.height}`}
              </p>
            </div>

            <div
              aria-label="Metadata language"
              className="category-locale-tabs"
              role="tablist"
            >
              {localeCodes.map((candidate) => (
                <button
                  aria-label={languageByCode[candidate]?.label ?? candidate}
                  aria-selected={locale === candidate}
                  key={candidate}
                  onClick={() => {
                    setLocale(candidate);
                    setTranslation(translationFor(selected, candidate));
                  }}
                  role="tab"
                  type="button"
                >
                  <span>{languageByCode[candidate]?.nativeLabel ?? candidate.toUpperCase()}</span>
                </button>
              ))}
            </div>

            <div className="media-metadata">
              <label className="admin-field">
                <span>Default title</span>
                <input
                  maxLength={240}
                  onChange={(event) =>
                    setTranslation((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  value={translation.title}
                />
              </label>
              {selected.kind === "image" ? (
                <label className="admin-field">
                  <span>Default alt text</span>
                  <input
                    maxLength={240}
                    onChange={(event) =>
                      setTranslation((current) => ({
                        ...current,
                        alt: event.target.value,
                      }))
                    }
                    value={translation.alt}
                  />
                </label>
              ) : null}
              <label className="admin-field">
                <span>Default caption</span>
                <textarea
                  maxLength={1000}
                  onChange={(event) =>
                    setTranslation((current) => ({
                      ...current,
                      caption: event.target.value,
                    }))
                  }
                  rows={3}
                  value={translation.caption}
                />
              </label>
              <button
                className="admin-button admin-button--primary"
                disabled={busy}
                onClick={() => void saveMetadata()}
                type="button"
              >
                Save metadata
              </button>
            </div>

            {selected.kind === "video" ? (
              <div className="media-inspector__section">
                <strong>Video poster</strong>
                <p>
                  {selected.posterMediaId === undefined
                    ? "No poster selected."
                    : `Poster asset ${selected.posterMediaId}`}
                </p>
                <button
                  className="admin-button admin-button--quiet"
                  onClick={() => setPosterPickerOpen(true)}
                  type="button"
                >
                  Choose ready image
                </button>
              </div>
            ) : null}

            <div className="media-inspector__section media-usages">
              <div className="media-usages__heading">
                <strong>Used in content</strong>
                <span>{usages.length}</span>
              </div>
              {usagesLoading ? (
                <p aria-live="polite">Checking references…</p>
              ) : usages.length === 0 ? (
                <div className="media-usages__empty">
                  <strong>Available to use</strong>
                  <p>This asset is not referenced by any managed content.</p>
                </div>
              ) : (
                <div className="media-usage-groups">
                  {usageGroups.map(([ownerType, ownerUsages]) => (
                    <section key={ownerType}>
                      <header>
                        <strong>{OWNER_TYPE_LABELS[ownerType]}</strong>
                        <span>{ownerUsages.length}</span>
                      </header>
                      <ul>
                        {ownerUsages.map((usage) => {
                          const href = usageHref(usage);
                          return (
                            <li
                              aria-label={usageLabel(usage)}
                              key={`${usage.kind}:${usage.ownerId}:${usage.path}`}
                            >
                              {href === undefined ? (
                                <strong>{usage.ownerLabel}</strong>
                              ) : (
                                <Link href={href}>{usage.ownerLabel}</Link>
                              )}
                              <span>{usagePlacement(usage)}</span>
                              <small>
                                {usageStage(usage)}
                                {usage.locale === undefined
                                  ? ""
                                  : ` · ${usage.locale.toUpperCase()}`}
                              </small>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ))}
                </div>
              )}
              <p className="media-usages__coverage">
                References are tracked automatically for Products, Categories,
                and video posters. News, Stories, Blogs, Pages, and Other content
                will appear here when those managed CMS modules are enabled.
              </p>
            </div>

            <div className="media-inspector__actions">
              <label className="admin-button admin-button--quiet media-upload-button">
                <span>Upload replacement</span>
                <input
                  accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,.pdf"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file !== undefined) void performUpload(file, true);
                    event.target.value = "";
                  }}
                  type="file"
                />
              </label>
              <button
                className="admin-button admin-button--danger"
                disabled={busy || usages.length > 0}
                onClick={() => void removeSelected()}
                type="button"
              >
                Delete asset
              </button>
            </div>
          </aside>
        )}
      </div>

      {posterPickerOpen && selected !== undefined ? (
        <MediaPicker
          kind="image"
          onClose={() => setPosterPickerOpen(false)}
          onSelect={(poster) => void selectPoster(poster)}
          {...(selected.posterMediaId === undefined
            ? {}
            : { selectedId: selected.posterMediaId })}
          title="Choose video poster"
        />
      ) : null}
    </section>
  );
}
