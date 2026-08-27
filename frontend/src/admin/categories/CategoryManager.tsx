"use client";

import {
  createCategorySlugBase,
  type AdminMediaDto,
  type CategoryAdminDto,
  type LocaleCode,
} from "@maglive/contracts";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { AdminApiError } from "../auth/api";
import { getMedia } from "../media/api";
import { MediaPicker } from "../media/MediaPicker";
import { MediaPreview } from "../media/MediaPreview";
import { useLanguages } from "../languages/LanguageProvider";
import {
  archiveCategory,
  createCategory,
  deleteCategory,
  listCategories,
  publishCategory,
  reorderCategories,
  unpublishCategory,
  updateCategory,
} from "./api";

type EditorFields = {
  slug: string;
  parentId: string;
  sortOrder: string;
  name: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  imageMediaId: string;
  imageAlt: string;
  imageTitle: string;
};

const emptyFields: EditorFields = {
  slug: "",
  parentId: "",
  sortOrder: "0",
  name: "",
  description: "",
  seoTitle: "",
  seoDescription: "",
  imageMediaId: "",
  imageAlt: "",
  imageTitle: "",
};

function fieldsFor(
  category: CategoryAdminDto,
  locale: LocaleCode,
): EditorFields {
  const translation = category.translations[locale];
  return {
    slug: category.slug,
    parentId: category.parentId ?? "",
    sortOrder: String(category.sortOrder),
    name: translation?.name ?? "",
    description: translation?.description ?? "",
    seoTitle: translation?.seo.title ?? "",
    seoDescription: translation?.seo.description ?? "",
    imageMediaId: category.image?.mediaId ?? "",
    imageAlt: category.image?.translations[locale]?.alt ?? "",
    imageTitle: category.image?.translations[locale]?.title ?? "",
  };
}

function humanizeState(state: CategoryAdminDto["localeStates"][LocaleCode]) {
  return state.replace("-", " ");
}

function errorMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return "The category operation failed unexpectedly.";
  }
  switch (error.code) {
    case "VERSION_CONFLICT":
    case "REORDER_SET_CHANGED":
      return "This category changed elsewhere. Refresh the workspace and try again.";
    case "SESSION_EXPIRED":
    case "AUTH_REQUIRED":
      return "Your administrator session has expired. Sign in again.";
    case "API_UNAVAILABLE":
      return "The CMS API is unavailable. Your unsaved edits are still in this browser.";
    case "SHARED_PROMOTION_REQUIRED":
      return "Shared category fields require confirmation for every published language.";
    default:
      return error.message;
  }
}

function CategoryTree({
  categories,
  parentId,
  selectedId,
  onSelect,
}: {
  categories: readonly CategoryAdminDto[];
  parentId: string | null;
  selectedId: string | null;
  onSelect: (category: CategoryAdminDto) => void;
}) {
  const children = categories
    .filter((category) => category.parentId === parentId)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug),
    );
  if (children.length === 0) return null;

  return (
    <ul className={parentId === null ? "category-tree" : "category-tree__branch"}>
      {children.map((category) => (
        <li key={category.id}>
          <button
            aria-current={selectedId === category.id ? "true" : undefined}
            className="category-tree__item"
            onClick={() => onSelect(category)}
            type="button"
          >
            <span>
              {category.translations.en?.name ??
                Object.values(category.translations)[0]?.name ??
                category.slug}
            </span>
            <small>{category.status}</small>
          </button>
          <CategoryTree
            categories={categories}
            onSelect={onSelect}
            parentId={category.id}
            selectedId={selectedId}
          />
        </li>
      ))}
    </ul>
  );
}

export function CategoryManager() {
  const { localeCodes, languageByCode } = useLanguages();
  const [categories, setCategories] = useState<CategoryAdminDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locale, setLocale] = useState<LocaleCode>("en");
  const [fields, setFields] = useState<EditorFields>(emptyFields);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<AdminMediaDto | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  const selected = useMemo(
    () => categories.find((category) => category.id === selectedId),
    [categories, selectedId],
  );
  const roots = categories.filter(
    (category) =>
      category.parentId === null &&
      category.id !== selectedId &&
      category.status === "active",
  );
  const siblings = categories
    .filter(
      (category) =>
        category.parentId === (selected?.parentId ?? null) &&
        category.status !== "deleting",
    )
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.slug.localeCompare(right.slug),
    );
  const siblingIndex = siblings.findIndex(
    (category) => category.id === selectedId,
  );

  useEffect(() => {
    function warnOnUnload(event: BeforeUnloadEvent) {
      if (dirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", warnOnUnload);
    return () => window.removeEventListener("beforeunload", warnOnUnload);
  }, [dirty]);

  useEffect(() => {
    let active = true;
    void listCategories()
      .then((result) => {
        if (!active) return;
        setCategories(result);
        const first = result[0];
        if (first !== undefined) {
          setSelectedId(first.id);
          setFields(fieldsFor(first, "en"));
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(errorMessage(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const mediaId = selected?.image?.mediaId;
    if (mediaId === undefined) return;
    let active = true;
    void getMedia(mediaId)
      .then((media) => {
        if (active) setSelectedMedia(media);
      })
      .catch(() => {
        if (active) setSelectedMedia(null);
      });
    return () => {
      active = false;
    };
  }, [selected]);

  function confirmDiscard(): boolean {
    return !dirty || window.confirm("Discard your unsaved category changes?");
  }

  function selectCategory(category: CategoryAdminDto): void {
    if (!confirmDiscard()) return;
    setSelectedId(category.id);
    setFields(fieldsFor(category, locale));
    if (category.image === undefined) setSelectedMedia(null);
    setDirty(false);
    setError(null);
    setNotice(null);
  }

  function startNew(): void {
    if (!confirmDiscard()) return;
    setSelectedId(null);
    setLocale("en");
    setFields(emptyFields);
    setSelectedMedia(null);
    setDirty(false);
    setError(null);
    setNotice(null);
  }

  function changeLocale(nextLocale: LocaleCode): void {
    if (nextLocale === locale || !confirmDiscard()) return;
    setLocale(nextLocale);
    setFields(selected === undefined ? emptyFields : fieldsFor(selected, nextLocale));
    setDirty(false);
    setError(null);
    setNotice(null);
  }

  function updateField<Key extends keyof EditorFields>(
    key: Key,
    value: EditorFields[Key],
  ): void {
    setFields((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setNotice(null);
  }

  function updateCategoryName(value: string): void {
    setFields((current) => ({
      ...current,
      name: value,
      ...(selected === undefined && locale === "en"
        ? { slug: createCategorySlugBase(value) }
        : {}),
    }));
    setDirty(true);
    setNotice(null);
  }

  function replaceCategory(category: CategoryAdminDto, message: string): void {
    setCategories((current) => {
      const exists = current.some((item) => item.id === category.id);
      return exists
        ? current.map((item) => (item.id === category.id ? category : item))
        : [...current, category];
    });
    setSelectedId(category.id);
    setFields(fieldsFor(category, locale));
    setDirty(false);
    setError(null);
    setNotice(message);
  }

  async function save(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const translation = {
        name: fields.name.trim(),
        ...(fields.description.trim() === ""
          ? {}
          : { description: fields.description.trim() }),
        seo: {
          ...(fields.seoTitle.trim() === ""
            ? {}
            : { title: fields.seoTitle.trim() }),
          ...(fields.seoDescription.trim() === ""
            ? {}
            : { description: fields.seoDescription.trim() }),
        },
      };
      if (selected === undefined) {
        const image =
          fields.imageMediaId === ""
            ? undefined
            : {
                mediaId: fields.imageMediaId,
                translations: {
                  [locale]: {
                    alt: fields.imageAlt.trim(),
                    ...(fields.imageTitle.trim() === ""
                      ? {}
                      : { title: fields.imageTitle.trim() }),
                  },
                },
              };
        const created = await createCategory({
          slug: fields.slug.trim(),
          parentId: fields.parentId === "" ? null : fields.parentId,
          sortOrder: Number(fields.sortOrder),
          translations: { [locale]: translation },
          ...(image === undefined ? {} : { image }),
        });
        replaceCategory(created, "Category draft created.");
      } else {
        const image =
          fields.imageMediaId === ""
            ? null
            : {
                mediaId: fields.imageMediaId,
                translations: {
                  ...selected.image?.translations,
                  [locale]: {
                    alt: fields.imageAlt.trim(),
                    ...(fields.imageTitle.trim() === ""
                      ? {}
                      : { title: fields.imageTitle.trim() }),
                  },
                },
              };
        const updated = await updateCategory(selected.id, {
          version: selected.version,
          slug: fields.slug.trim(),
          parentId: fields.parentId === "" ? null : fields.parentId,
          sortOrder: Number(fields.sortOrder),
          translations: {
            ...selected.translations,
            [locale]: translation,
          },
          image,
        });
        replaceCategory(updated, "Category draft saved.");
      }
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function runCategoryAction(
    action: () => Promise<CategoryAdminDto>,
    message: string,
  ): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      replaceCategory(await action(), message);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function publishCurrentLocale(): Promise<void> {
    if (selected === undefined) return;
    const sharedChanged =
      selected.publishedGlobal !== undefined &&
      selected.publishedGlobal.sourceHash !== selected.workingGlobalHash;
    const liveLocales = localeCodes.filter(
      (candidate) => selected.publishedSnapshots[candidate] !== undefined,
    );
    let locales: LocaleCode[] = [locale];
    let promoteShared = false;
    if (sharedChanged) {
      if (
        !window.confirm(
          "Shared slug, parent, order, or image fields changed. Publish those changes to every live language?",
        )
      ) {
        return;
      }
      locales = [...new Set([...liveLocales, locale])];
      promoteShared = true;
    }
    await runCategoryAction(
      () =>
        publishCategory(selected.id, {
          version: selected.version,
          locales,
          promoteShared,
        }),
      `${languageByCode[locale]?.label ?? locale} published.`,
    );
  }

  async function moveSelected(direction: -1 | 1): Promise<void> {
    if (selected === undefined) return;
    const targetIndex = siblingIndex + direction;
    if (siblingIndex < 0 || targetIndex < 0 || targetIndex >= siblings.length) {
      return;
    }
    const ordered = [...siblings];
    const target = ordered[targetIndex];
    if (target === undefined) return;
    ordered[targetIndex] = selected;
    ordered[siblingIndex] = target;
    setBusy(true);
    setError(null);
    try {
      const result = await reorderCategories({
        parentId: selected.parentId,
        categories: ordered.map((category) => ({
          id: category.id,
          version: category.version,
        })),
      });
      setCategories(result);
      const refreshed =
        result.find((category) => category.id === selected.id) ?? selected;
      setFields(fieldsFor(refreshed, locale));
      setNotice("Category order updated.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function removeSelected(): Promise<void> {
    if (
      selected === undefined ||
      !window.confirm("Permanently delete this unpublished category?")
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await deleteCategory(selected.id, selected.version);
      const remaining = categories.filter(
        (category) => category.id !== selected.id,
      );
      setCategories(remaining);
      const next = remaining[0];
      setSelectedId(next?.id ?? null);
      setFields(next === undefined ? emptyFields : fieldsFor(next, locale));
      setDirty(false);
      setNotice("Category permanently deleted.");
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section aria-busy="true" className="category-loading">
        <span className="admin-kicker">Categories · Loading</span>
        <h1>Preparing the category workspace…</h1>
      </section>
    );
  }

  return (
    <section className="category-workspace">
      <header className="category-workspace__header">
        <div>
          <span className="admin-kicker">Catalog architecture</span>
          <h1>Product categories</h1>
          <p>
            Manage a two-level hierarchy, localized copy, ordering, and
            publication without exposing draft edits.
          </p>
        </div>
        <button
          className="admin-button admin-button--primary"
          onClick={startNew}
          type="button"
        >
          New category
        </button>
      </header>

      {error === null ? null : (
        <div className="admin-alert" role="alert" tabIndex={-1}>
          {error}
        </div>
      )}
      {notice === null ? null : (
        <div className="admin-notice" role="status">
          {notice}
        </div>
      )}

      <div className="category-layout">
        <aside aria-label="Category hierarchy" className="category-panel">
          <div className="category-panel__heading">
            <strong>Hierarchy</strong>
            <span>{categories.length} total</span>
          </div>
          {categories.length === 0 ? (
            <p className="category-empty">No categories yet.</p>
          ) : (
            <CategoryTree
              categories={categories}
              onSelect={selectCategory}
              parentId={null}
              selectedId={selectedId}
            />
          )}
        </aside>

        <div className="category-editor">
          <div className="category-editor__topline">
            <div>
              <span className="admin-kicker">
                {selected === undefined ? "New draft" : selected.slug}
              </span>
              <h2>
                {selected === undefined
                  ? "Create category"
                  : selected.translations[locale]?.name || "Untitled translation"}
              </h2>
            </div>
            {selected === undefined ? null : (
              <span className={`category-status category-status--${selected.status}`}>
                {selected.status}
              </span>
            )}
          </div>

          <div aria-label="Content language" className="category-locale-tabs" role="tablist">
            {localeCodes.map((candidate) => {
              const state =
                selected?.localeStates[candidate] ??
                (candidate === locale && fields.name !== ""
                  ? "draft"
                  : "incomplete");
              return (
                <button
                  aria-label={`${languageByCode[candidate]?.label ?? candidate} ${humanizeState(state)}`}
                  aria-selected={locale === candidate}
                  key={candidate}
                  onClick={() => changeLocale(candidate)}
                  role="tab"
                  type="button"
                >
                  <span>{languageByCode[candidate]?.nativeLabel ?? candidate.toUpperCase()}</span>
                  <small>{humanizeState(state)}</small>
                </button>
              );
            })}
          </div>

          <form className="category-form" onSubmit={(event) => void save(event)}>
            <fieldset disabled={busy || selected?.status === "archived"}>
              <legend>Shared category fields</legend>
              <div className="category-form__grid">
                <div className="admin-field">
                  <label htmlFor="category-slug">Category URL slug</label>
                  <input
                    id="category-slug"
                    maxLength={120}
                    placeholder="Generated from the English category name"
                    readOnly
                    required
                    value={fields.slug}
                  />
                  <small>{fields.slug ? <>Category path: /products/{fields.slug}</> : "Enter the English display name to generate it."} A number is added automatically if it already exists.</small>
                </div>
                <div className="admin-field">
                  <label htmlFor="category-parent">Parent category</label>
                  <select
                    id="category-parent"
                    onChange={(event) =>
                      updateField("parentId", event.target.value)
                    }
                    value={fields.parentId}
                  >
                    <option value="">Root category</option>
                    {roots.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.translations.en?.name ?? category.slug}
                      </option>
                    ))}
                  </select>
                  <small>Only root categories can be selected as parents.</small>
                </div>
                <div className="admin-field">
                  <label htmlFor="category-order">Sort order</label>
                  <input
                    id="category-order"
                    min="0"
                    onChange={(event) =>
                      updateField("sortOrder", event.target.value)
                    }
                    required
                    type="number"
                    value={fields.sortOrder}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset disabled={busy || selected?.status === "archived"}>
              <legend>{languageByCode[locale]?.label ?? locale} content</legend>
              <div className="category-form__grid">
                <div className="admin-field category-form__wide">
                  <label htmlFor="category-name">Display name</label>
                  <input
                    id="category-name"
                    maxLength={160}
                    onChange={(event) => updateCategoryName(event.target.value)}
                    required
                    value={fields.name}
                  />
                </div>
                <div className="admin-field category-form__wide">
                  <label htmlFor="category-description">Description</label>
                  <textarea
                    id="category-description"
                    maxLength={2000}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    rows={5}
                    value={fields.description}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="category-seo-title">SEO title</label>
                  <input
                    id="category-seo-title"
                    maxLength={70}
                    onChange={(event) =>
                      updateField("seoTitle", event.target.value)
                    }
                    placeholder="Defaults to display name"
                    value={fields.seoTitle}
                  />
                </div>
                <div className="admin-field">
                  <label htmlFor="category-seo-description">
                    SEO description
                  </label>
                  <textarea
                    id="category-seo-description"
                    maxLength={320}
                    onChange={(event) =>
                      updateField("seoDescription", event.target.value)
                    }
                    rows={3}
                    value={fields.seoDescription}
                  />
                </div>
              </div>
            </fieldset>

            <fieldset disabled={busy || selected?.status === "archived"}>
              <legend>Category image</legend>
              <div className="category-media-editor">
                {selectedMedia === null ? (
                  <div className="category-media-placeholder">
                    <strong>No reusable image selected</strong>
                    <span>Choose a ready image from the media library.</span>
                  </div>
                ) : (
                  <div className="category-media-editor__preview">
                    <MediaPreview compact media={selectedMedia} />
                    <span>{selectedMedia.originalName}</span>
                  </div>
                )}
                <div className="category-media-editor__controls">
                  <button
                    className="admin-button admin-button--quiet"
                    onClick={() => setMediaPickerOpen(true)}
                    type="button"
                  >
                    {fields.imageMediaId === "" ? "Choose image" : "Replace image"}
                  </button>
                  {fields.imageMediaId === "" ? null : (
                    <button
                      className="admin-button admin-button--quiet"
                      onClick={() => {
                        setSelectedMedia(null);
                        updateField("imageMediaId", "");
                      }}
                      type="button"
                    >
                      Remove image
                    </button>
                  )}
                </div>
                {fields.imageMediaId === "" ? null : (
                  <div className="category-form__grid">
                    <div className="admin-field">
                      <label htmlFor="category-image-alt">
                        Contextual alt text · {languageByCode[locale]?.label ?? locale}
                      </label>
                      <input
                        id="category-image-alt"
                        maxLength={240}
                        onChange={(event) =>
                          updateField("imageAlt", event.target.value)
                        }
                        required
                        value={fields.imageAlt}
                      />
                    </div>
                    <div className="admin-field">
                      <label htmlFor="category-image-title">
                        Contextual image title
                      </label>
                      <input
                        id="category-image-title"
                        maxLength={240}
                        onChange={(event) =>
                          updateField("imageTitle", event.target.value)
                        }
                        value={fields.imageTitle}
                      />
                    </div>
                  </div>
                )}
              </div>
            </fieldset>

            <div className="category-actions">
              <button
                className="admin-button admin-button--primary"
                disabled={busy || selected?.status === "archived"}
                type="submit"
              >
                {busy ? "Working…" : selected === undefined ? "Create draft" : "Save draft"}
              </button>
              {selected === undefined ? null : (
                <>
                  <button
                    className="admin-button admin-button--quiet"
                    disabled={
                      busy ||
                      dirty ||
                      selected.status !== "active" ||
                      selected.localeStates[locale] === "incomplete"
                    }
                    onClick={() => void publishCurrentLocale()}
                    type="button"
                  >
                    Publish {languageByCode[locale]?.label ?? locale}
                  </button>
                  {selected.publishedSnapshots[locale] === undefined ? null : (
                    <button
                      className="admin-button admin-button--quiet"
                      disabled={busy || dirty}
                      onClick={() =>
                        void runCategoryAction(
                          () =>
                            unpublishCategory(selected.id, {
                              version: selected.version,
                              locale,
                            }),
                          `${languageByCode[locale]?.label ?? locale} unpublished.`,
                        )
                      }
                      type="button"
                    >
                      Unpublish
                    </button>
                  )}
                </>
              )}
            </div>
          </form>

          {selected === undefined ? null : (
            <div className="category-utilities">
              <div>
                <strong>Sibling order</strong>
                <button
                  disabled={busy || dirty || siblingIndex <= 0}
                  onClick={() => void moveSelected(-1)}
                  type="button"
                >
                  Move up
                </button>
                <button
                  disabled={
                    busy || dirty || siblingIndex === siblings.length - 1
                  }
                  onClick={() => void moveSelected(1)}
                  type="button"
                >
                  Move down
                </button>
              </div>
              <div>
                <strong>Lifecycle</strong>
                {selected.firstPublishedAt === undefined ? (
                  <button
                    disabled={busy || dirty}
                    onClick={() => void removeSelected()}
                    type="button"
                  >
                    Delete draft
                  </button>
                ) : (
                  <button
                    disabled={
                      busy || dirty || selected.status === "archived"
                    }
                    onClick={() => {
                      if (
                        window.confirm(
                          "Archive this category and hide its public descendants?",
                        )
                      ) {
                        void runCategoryAction(
                          () =>
                            archiveCategory(selected.id, selected.version),
                          "Category archived.",
                        );
                      }
                    }}
                    type="button"
                  >
                    Archive
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {mediaPickerOpen ? (
        <MediaPicker
          kind="image"
          onClose={() => setMediaPickerOpen(false)}
          onSelect={(media) => {
            setSelectedMedia(media);
            setMediaPickerOpen(false);
            setFields((current) => ({
              ...current,
              imageMediaId: media.id,
              imageAlt:
                current.imageAlt ||
                media.defaultTranslations[locale]?.alt ||
                "",
              imageTitle:
                current.imageTitle ||
                media.defaultTranslations[locale]?.title ||
                "",
            }));
            setDirty(true);
          }}
          {...(fields.imageMediaId === ""
            ? {}
            : { selectedId: fields.imageMediaId })}
          title="Choose category image"
        />
      ) : null}
    </section>
  );
}
