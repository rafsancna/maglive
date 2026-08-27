"use client";

import {
  DEFAULT_LOCALE,
  createProductSlugBase,
  type CategoryAdminDto,
  type CreateProductRequest,
  type FieldError,
  type LocaleCode,
  type ProductAdminDto,
  type ProductFeature,
  type ProductMediaUsage,
  type ProductTextItem,
  type ProductTranslation,
  type ProductWorkingData,
  type UpdateProductRequest,
} from "@maglive/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AdminApiError } from "../auth/api";
import { listCategories } from "../categories/api";
import type { AdminMediaDto } from "@maglive/contracts";
import { MediaPicker } from "../media/MediaPicker";
import { createProduct, createPreviewGrant, getProduct, updateProduct } from "./api";
import { archiveProduct, publishProduct, unpublishProduct } from "./api";
import { useLanguages } from "../languages/LanguageProvider";

type EditorProps = Readonly<{ productId?: string }>;

type EditorState = ProductWorkingData;

type FieldErrors = Readonly<Record<string, string>>;

const EDITOR_SECTIONS = [
  { id: "basic", label: "Basic", description: "Identity and catalog" },
  { id: "content", label: "Content", description: "Localized product copy" },
  { id: "specifications", label: "Specifications", description: "Technical details" },
  { id: "media", label: "Media", description: "Images and downloads" },
  { id: "seo", label: "SEO", description: "Search presentation" },
  { id: "publication", label: "Publication", description: "Preview and publish" },
] as const;

type EditorSectionId = (typeof EDITOR_SECTIONS)[number]["id"];

const emptyTranslation = (): ProductTranslation => ({
  name: "",
  shortDescription: "",
  longDescriptionMarkdown: "",
  features: [],
  advantages: [],
  applications: [],
  warrantyInformation: "",
  seo: {},
});

const emptyState = (): EditorState => ({
  slug: "",
  categoryId: "",
  model: undefined,
  series: undefined,
  translations: {
    en: emptyTranslation(),
    zh: emptyTranslation(),
  },
  specifications: [],
  mediaUsages: [],
  pageTemplate: "standard",
  displayOrder: 0,
  featured: false,
});

function stateFromDto(dto: ProductAdminDto): EditorState {
  return {
    slug: dto.slug,
    categoryId: dto.categoryId,
    ...(dto.model === undefined ? {} : { model: dto.model }),
    ...(dto.series === undefined ? {} : { series: dto.series }),
    translations: dto.translations,
    specifications: dto.specifications,
    mediaUsages: dto.mediaUsages,
    pageTemplate: dto.pageTemplate,
    displayOrder: dto.displayOrder,
    featured: dto.featured,
  };
}

function cloneState(value: EditorState): EditorState {
  return JSON.parse(JSON.stringify(value)) as EditorState;
}

function errorMessage(reason: unknown): string {
  if (!(reason instanceof AdminApiError)) {
    return "The Product could not be saved.";
  }
  if (reason.status === 401 || reason.code === "SESSION_EXPIRED") {
    return "Your administrator session has expired. Sign in again before saving.";
  }
  if (reason.status === 409 || reason.code === "VERSION_CONFLICT") {
    return "This Product changed elsewhere. Reload it before saving your edits.";
  }
  if (reason.status === 422 || reason.code === "VALIDATION_FAILED") {
    return "Review the highlighted fields, then save the draft again.";
  }
  if (reason.status === 503 || reason.code === "API_UNAVAILABLE") {
    return "The CMS API is unavailable. Your edits remain in this form.";
  }
  return reason.message;
}

function normalizedPayload(
  state: EditorState,
  localeCodes: readonly LocaleCode[],
): EditorState {
  const copy = cloneState(state);
  if (copy.model?.trim() === "") delete copy.model;
  if (copy.series?.trim() === "") delete copy.series;
  for (const locale of localeCodes) {
    const translation = copy.translations[locale];
    if (translation === undefined) continue;
    if (translation.name.trim() === "") {
      delete copy.translations[locale];
      continue;
    }
    if (translation.shortDescription === "") delete translation.shortDescription;
    if (translation.longDescriptionMarkdown === "") delete translation.longDescriptionMarkdown;
    if (translation.warrantyInformation === "") delete translation.warrantyInformation;
    if (translation.seo.title?.trim() === "") delete translation.seo.title;
    if (translation.seo.description?.trim() === "") delete translation.seo.description;
  }
  return copy;
}

function markdownPreview(markdown: string): string {
  // Plain text rendering is intentionally conservative: React escapes the value,
  // while this small formatter keeps headings and emphasis readable without HTML.
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

function fieldErrorFor(errors: FieldErrors, path: string): string | undefined {
  return errors[path];
}

function normalizedFieldErrors(details: readonly FieldError[]): FieldErrors {
  return Object.fromEntries(
    details.map(({ path, message }) => [path.replace(/^body\./, ""), message]),
  );
}

function sectionForErrorPath(path: string): EditorSectionId {
  const normalized = path.replace(/^body\./, "");
  if (normalized.startsWith("translations.") && normalized.includes(".seo.")) {
    return "seo";
  }
  if (normalized.startsWith("translations.")) return "content";
  if (normalized.startsWith("specifications.")) return "specifications";
  if (normalized.startsWith("mediaUsages.")) return "media";
  if (normalized === "pageTemplate") return "seo";
  return "basic";
}

function slugifyKey(value: string, fallback: string): string {
  const key = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return key || fallback;
}

function ContentItemsEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: readonly (ProductFeature | ProductTextItem)[];
  onChange: (items: (ProductFeature | ProductTextItem)[]) => void;
}) {
  return (
    <div className="product-editor__nested">
      <div className="product-editor__nested-header"><strong>{label}</strong><button className="admin-button admin-button--quiet" onClick={() => onChange([...items, { key: `${label.toLowerCase()}-${items.length + 1}`, title: "" }])} type="button">Add item</button></div>
      {items.length === 0 ? <p className="product-editor__muted">No items yet.</p> : null}
      {items.map((item, index) => (
        <div className="product-editor__nested-row" key={`${item.key}-${index}`}>
          <input aria-label={`${label} ${index + 1} key`} value={item.key} onChange={(e) => { const next = [...items]; next[index] = { ...item, key: slugifyKey(e.target.value, `item-${index + 1}`) }; onChange(next); }} />
          <input aria-label={`${label} ${index + 1} title`} placeholder="Title" value={item.title} onChange={(e) => { const next = [...items]; next[index] = { ...item, title: e.target.value }; onChange(next); }} />
          <input aria-label={`${label} ${index + 1} body`} placeholder="Optional supporting text" value={item.body ?? ""} onChange={(e) => { const next = [...items]; next[index] = { ...item, body: e.target.value }; onChange(next); }} />
          <div className="product-editor__move"><button aria-label={`Move ${label} ${index + 1} up`} className="admin-button admin-button--quiet" disabled={index === 0} onClick={() => { if (index === 0) return; const next = [...items]; const previous = next[index - 1]; if (previous === undefined) return; next[index - 1] = item; next[index] = previous; onChange(next); }} type="button">Up</button><button aria-label={`Move ${label} ${index + 1} down`} className="admin-button admin-button--quiet" disabled={index === items.length - 1} onClick={() => { if (index >= items.length - 1) return; const following = items[index + 1]; if (following === undefined) return; const next = [...items]; next[index + 1] = item; next[index] = following; onChange(next); }} type="button">Down</button></div>
          <button aria-label={`Remove ${label} ${index + 1}`} className="admin-button admin-button--quiet" onClick={() => onChange(items.filter((_, candidate) => candidate !== index))} type="button">Remove</button>
        </div>
      ))}
    </div>
  );
}

export function ProductEditor({ productId }: EditorProps) {
  const router = useRouter();
  const { localeCodes, languageByCode } = useLanguages();
  const isNew = productId === undefined;
  const [state, setState] = useState<EditorState>(() => emptyState());
  const [loaded, setLoaded] = useState<ProductAdminDto | null>(null);
  const [categories, setCategories] = useState<CategoryAdminDto[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [locale, setLocale] = useState<LocaleCode>(DEFAULT_LOCALE);
  const [activeSection, setActiveSection] = useState<EditorSectionId>("basic");
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [previewMarkdown, setPreviewMarkdown] = useState(false);
  const [mediaPickerRole, setMediaPickerRole] = useState<"hero" | "gallery" | "video" | "backgroundVideo" | "datasheet" | "certificate" | "brochure" | "document" | "openGraph" | null>(null);

  useEffect(() => {
    let active = true;
    void listCategories()
      .then((items) => {
        if (!active) return;
        setCategories(items);
        setCategoriesError(null);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setCategories([]);
        setCategoriesError(
          reason instanceof AdminApiError ? reason.message : "The category list could not be loaded.",
        );
      })
      .finally(() => {
        if (active) setCategoriesLoading(false);
      });
    if (isNew) return () => { active = false; };
    void getProduct(productId)
      .then((dto) => {
        if (!active) return;
        setLoaded(dto);
        setState(stateFromDto(dto));
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(errorMessage(reason));
        setLoading(false);
      });
    return () => { active = false; };
  }, [isNew, productId]);

  useEffect(() => {
    function warn(event: BeforeUnloadEvent) {
      if (dirty) event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const translation = state.translations[locale] ?? emptyTranslation();
  const categoryOptions = useMemo(
    () => categories.filter((category) => category.status === "active" && !categories.some((candidate) => candidate.parentId === category.id)),
    [categories],
  );

  function mutate(mutator: (draft: EditorState) => void): void {
    setState((current) => {
      const next = cloneState(current);
      mutator(next);
      return next;
    });
    setDirty(true);
    setNotice(null);
    setError(null);
  }

  function updateTranslation(field: keyof ProductTranslation, value: string): void {
    mutate((draft) => {
      const existing = draft.translations[locale] ?? emptyTranslation();
      draft.translations[locale] = { ...existing, [field]: value };
      if (isNew && locale === DEFAULT_LOCALE && field === "name") {
        draft.slug = createProductSlugBase(value);
      }
    });
  }

  function updateEnglishName(value: string): void {
    mutate((draft) => {
      const existing = draft.translations[DEFAULT_LOCALE] ?? emptyTranslation();
      draft.translations[DEFAULT_LOCALE] = { ...existing, name: value };
      if (isNew) draft.slug = createProductSlugBase(value);
    });
  }

  async function save(): Promise<void> {
    const englishName = state.translations[DEFAULT_LOCALE]?.name.trim() ?? "";
    if (isNew && (englishName === "" || state.categoryId === "" || state.slug === "")) {
      setActiveSection("basic");
      setFieldErrors({
        ...(englishName === "" ? { [`translations.${DEFAULT_LOCALE}.name`]: "Enter an English product name." } : {}),
        ...(state.categoryId === "" ? { categoryId: "Select a leaf category." } : {}),
        ...(state.slug === "" && englishName !== "" ? { slug: "The English name must contain letters or numbers that can form a URL." } : {}),
      });
      setError("Add the required draft details before saving. Everything else can be completed later.");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    setFieldErrors({});
    const payload = normalizedPayload(state, localeCodes);
    try {
      const saved = isNew
        ? await createProduct(payload as CreateProductRequest)
        : await updateProduct(productId, {
            ...payload,
            version: loaded?.version ?? 0,
          } as UpdateProductRequest);
      setLoaded(saved);
      setState(stateFromDto(saved));
      setDirty(false);
      setNotice("Draft saved. Your published snapshots were not changed.");
      if (isNew) router.replace(`/admin/products/${saved.id}`);
    } catch (reason) {
      setError(errorMessage(reason));
      if (reason instanceof AdminApiError) {
        setFieldErrors(normalizedFieldErrors(reason.details));
        const firstError = reason.details[0];
        if (firstError !== undefined) setActiveSection(sectionForErrorPath(firstError.path));
      }
    } finally {
      setSaving(false);
    }
  }

  async function publishCurrent(): Promise<void> {
    if (loaded === null || dirty) return;
    const sharedPromotion = loaded.sharedState === "changes-pending";
    const liveLocales = localeCodes.filter((candidate) => loaded.publishedSnapshots[candidate] !== undefined);
    const locales = sharedPromotion
      ? [...new Set([...liveLocales, locale])]
      : [locale];
    if (sharedPromotion && !window.confirm(`Shared fields changed. Republish ${locales.map((candidate) => languageByCode[candidate]?.label ?? candidate).join(", ")} together?`)) return;
    setSaving(true);
    setError(null);
    try {
      const result = await publishProduct(loaded.id, {
        version: loaded.version,
        locales,
        promoteShared: sharedPromotion,
      });
      setLoaded(result.product);
      setState(stateFromDto(result.product));
      setNotice(`${languageByCode[locale]?.label ?? locale} publication completed.`);
    } catch (reason) {
      setError(errorMessage(reason));
      if (reason instanceof AdminApiError) {
        setFieldErrors(normalizedFieldErrors(reason.details));
        const firstError = reason.details[0];
        if (firstError !== undefined) setActiveSection(sectionForErrorPath(firstError.path));
      }
    } finally {
      setSaving(false);
    }
  }

  async function unpublishCurrent(): Promise<void> {
    if (loaded === null || !loaded.publishedSnapshots[locale] || !window.confirm(`Unpublish ${languageByCode[locale]?.label ?? locale}?`)) return;
    setSaving(true);
    try {
      const result = await unpublishProduct(loaded.id, { version: loaded.version, locale });
      setLoaded(result);
      setState(stateFromDto(result));
      setNotice(`${languageByCode[locale]?.label ?? locale} was unpublished.`);
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function archiveCurrent(): Promise<void> {
    if (loaded === null || !window.confirm("Archive this Product?")) return;
    setSaving(true);
    try {
      const result = await archiveProduct(loaded.id, loaded.version);
      setLoaded(result);
      setState(stateFromDto(result));
      setNotice("Product archived.");
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  async function previewCurrent(): Promise<void> {
    if (loaded === null || dirty) return;
    setSaving(true);
    setError(null);
    try {
      const grant = await createPreviewGrant(loaded.id, locale);
      window.location.assign(grant.previewUrl);
    } catch (reason) { setError(errorMessage(reason)); } finally { setSaving(false); }
  }

  function assignMedia(media: AdminMediaDto): void {
    if (mediaPickerRole === null) return;
    mutate((draft) => {
      const existing = draft.mediaUsages.find((usage) => usage.role === mediaPickerRole && usage.locale === undefined);
      if (existing) existing.mediaId = media.id;
      else draft.mediaUsages.push({ mediaId: media.id, role: mediaPickerRole, order: draft.mediaUsages.length, translations: {} } as ProductMediaUsage);
    });
    setMediaPickerRole(null);
  }

  function leave(): void {
    if (!dirty || window.confirm("Discard your unsaved Product changes?")) {
      router.push("/admin/products");
    }
  }

  if (loading) {
    return <section className="product-editor"><div className="product-editor__skeleton" aria-live="polite">Loading Product editor...</div></section>;
  }

  if (error !== null && !isNew && loaded === null) {
    return (
      <section className="product-editor">
        <Link className="text-link" href="/admin/products">Back to Products</Link>
        <div className="admin-alert" role="alert">{error}</div>
      </section>
    );
  }

  const localeState = loaded?.localeStates[locale] ?? "draft";
  const selectedMediaId = mediaPickerRole === null
    ? undefined
    : state.mediaUsages.find((usage) => usage.role === mediaPickerRole && usage.locale === undefined)?.mediaId;
  const englishName = state.translations[DEFAULT_LOCALE]?.name ?? "";
  const draftIdentityReady = englishName.trim() !== "" && state.categoryId !== "" && state.slug !== "";
  const noActiveLeafCategories = !categoriesLoading && categoriesError === null && categoryOptions.length === 0;
  const activeSectionIndex = EDITOR_SECTIONS.findIndex(({ id }) => id === activeSection);
  const canSave = dirty && !saving && (!isNew || draftIdentityReady);
  return (
    <section className="product-editor">
      <header className="product-editor__header">
        <div>
          <button className="product-editor__back" onClick={leave} type="button">Back to Products</button>
          <span className="admin-kicker">{isNew ? "New draft" : "Product editor"}</span>
          <h1>{isNew ? "Create Product" : state.translations.en?.name || state.slug || "Edit Product"}</h1>
          <p>Working content is saved separately from the published catalog.</p>
        </div>
        <div className="product-editor__actions">
          {loaded ? <div className="product-editor__status"><span className={`product-badge product-badge--${loaded.status}`}>{loaded.status}</span><small>Shared: {loaded.sharedState.replace("-", " ")}</small></div> : null}
          <button className="admin-button admin-button--primary" disabled={!canSave} form="product-editor-form" type="submit">
            {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </header>

      {notice ? <div className="admin-alert admin-alert--success" role="status">{notice}</div> : null}
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}

      <div aria-label="Product editor sections" className="product-editor__sections" role="tablist">
        {EDITOR_SECTIONS.map(({ id, label, description }, index) => (
          <button
            aria-controls={`product-${id}`}
            aria-selected={activeSection === id}
            className={activeSection === id ? "is-active" : undefined}
            key={id}
            onClick={() => setActiveSection(id)}
            role="tab"
            type="button"
          >
            <span>{String(index + 1).padStart(2, "0")}</span>
            <strong>{label}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>

      <div className="product-editor__language" role="tablist" aria-label="Product language">
        {localeCodes.map((candidate) => {
          const candidateTranslation = state.translations[candidate];
          const stateLabel = loaded?.localeStates[candidate] ?? "draft";
          return (
            <button
              aria-selected={candidate === locale}
              className={candidate === locale ? "is-active" : undefined}
              key={candidate}
              onClick={() => setLocale(candidate)}
              role="tab"
              type="button"
            >
              {languageByCode[candidate]?.nativeLabel ?? candidate.toUpperCase()}
              <small>{candidateTranslation?.name ? stateLabel : "incomplete"}</small>
            </button>
          );
        })}
      </div>

      {isNew ? (
        <div className={`product-editor__draft-readiness${draftIdentityReady ? " is-ready" : ""}`}>
          <div>
            <strong>{categoriesLoading ? "Checking product setup" : categoriesError !== null ? "Categories unavailable" : noActiveLeafCategories ? "A category is required first" : draftIdentityReady ? "Ready to save" : "Start with two details"}</strong>
            <span>{categoriesLoading ? "Loading the available catalog categories…" : categoriesError !== null ? "The category list could not be loaded. Retry from the Products page." : noActiveLeafCategories ? "There are no active leaf categories. Create a new leaf category in Categories before saving a product draft." : draftIdentityReady ? "The draft can be created now; every other section can be completed later." : "Add an English product name and a leaf category. The URL is generated automatically."}</span>
          </div>
          <span>{[englishName.trim() !== "", state.categoryId !== ""].filter(Boolean).length}/2 required</span>
        </div>
      ) : null}

      <form className="product-editor__body" id="product-editor-form" onSubmit={(event) => { event.preventDefault(); void save(); }}>
        {activeSection === "basic" ? (
        <fieldset className="product-editor__panel" id="product-basic">
          <legend>Basic information</legend>
          <p className="product-editor__muted">{isNew ? "Only the English product name and an active leaf category are required to create a draft." : "Manage the shared catalog identity and English name used as the administrator fallback."}</p>
          {noActiveLeafCategories ? <div className="product-editor__category-blocker" role="note"><div><strong>No active leaf category is available</strong><span>Products cannot reference archived categories. Create a new leaf category first.</span></div><Link className="admin-button admin-button--quiet" href="/admin/categories">Open Categories</Link></div> : null}
          <div className="product-editor__grid">
            <label className="admin-field"><span>English product name <b aria-hidden="true">*</b></span><input aria-invalid={fieldErrorFor(fieldErrors, `translations.${DEFAULT_LOCALE}.name`) !== undefined} aria-label="English product name" autoFocus={isNew} maxLength={160} onChange={(e) => updateEnglishName(e.target.value)} required value={englishName} />{fieldErrorFor(fieldErrors, `translations.${DEFAULT_LOCALE}.name`) ? <em>{fieldErrorFor(fieldErrors, `translations.${DEFAULT_LOCALE}.name`)}</em> : <small>This becomes the draft name shown in the Products workspace.</small>}</label>
            <label className="admin-field"><span>Category <b aria-hidden="true">*</b></span><select aria-invalid={fieldErrorFor(fieldErrors, "categoryId") !== undefined} aria-label="Category" disabled={categoriesLoading || categoriesError !== null || categoryOptions.length === 0} required value={state.categoryId} onChange={(e) => mutate((draft) => { draft.categoryId = e.target.value; })}><option value="">{categoriesLoading ? "Loading categories…" : categoryOptions.length === 0 ? "No active leaf categories" : "Select a leaf category"}</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.translations[locale]?.name ?? category.translations.en?.name ?? category.slug}</option>)}</select>{fieldErrorFor(fieldErrors, "categoryId") ? <em>{fieldErrorFor(fieldErrors, "categoryId")}</em> : null}</label>
            <label className="admin-field product-editor__wide"><span>Product URL slug</span><input aria-invalid={fieldErrorFor(fieldErrors, "slug") !== undefined} aria-label="Product URL slug" placeholder="Generated from the English product name" readOnly value={state.slug} /><small>{state.slug && state.categoryId ? <>Public URL: /products/{categories.find(({ id }) => id === state.categoryId)?.slug ?? "category"}/{state.slug}</> : "Select a category and enter the English product name."} A number is added automatically if the product slug already exists.</small>{fieldErrorFor(fieldErrors, "slug") ? <em>{fieldErrorFor(fieldErrors, "slug")}</em> : null}</label>
            <label className="admin-field"><span>Model</span><input aria-invalid={fieldErrorFor(fieldErrors, "model") !== undefined} value={state.model ?? ""} onChange={(e) => mutate((draft) => { draft.model = e.target.value; })} />{fieldErrorFor(fieldErrors, "model") ? <em>{fieldErrorFor(fieldErrors, "model")}</em> : null}</label>
            <label className="admin-field"><span>Series</span><input aria-invalid={fieldErrorFor(fieldErrors, "series") !== undefined} value={state.series ?? ""} onChange={(e) => mutate((draft) => { draft.series = e.target.value; })} />{fieldErrorFor(fieldErrors, "series") ? <em>{fieldErrorFor(fieldErrors, "series")}</em> : null}</label>
            <label className="admin-field"><span>Display order</span><input aria-invalid={fieldErrorFor(fieldErrors, "displayOrder") !== undefined} min={0} type="number" value={state.displayOrder} onChange={(e) => mutate((draft) => { draft.displayOrder = Number(e.target.value); })} />{fieldErrorFor(fieldErrors, "displayOrder") ? <em>{fieldErrorFor(fieldErrors, "displayOrder")}</em> : null}</label>
            <label className="admin-checkbox"><input checked={state.featured} onChange={(e) => mutate((draft) => { draft.featured = e.target.checked; })} type="checkbox" /><span>Feature this Product in catalog listings</span></label>
          </div>
        </fieldset>
        ) : null}

        {activeSection === "content" ? (
        <fieldset className="product-editor__panel" id="product-content">
          <legend>{languageByCode[locale]?.nativeLabel ?? locale.toUpperCase()} content</legend>
          <div className="product-editor__grid">
            <label className="admin-field product-editor__wide"><span>Name</span><input aria-invalid={fieldErrorFor(fieldErrors, `translations.${locale}.name`) !== undefined} aria-label="Name" value={translation.name} onChange={(e) => updateTranslation("name", e.target.value)} />{fieldErrorFor(fieldErrors, `translations.${locale}.name`) ? <em>{fieldErrorFor(fieldErrors, `translations.${locale}.name`)}</em> : null}</label>
            <label className="admin-field product-editor__wide"><span>Short description</span><textarea aria-invalid={fieldErrorFor(fieldErrors, `translations.${locale}.shortDescription`) !== undefined} rows={3} value={translation.shortDescription ?? ""} onChange={(e) => updateTranslation("shortDescription", e.target.value)} />{fieldErrorFor(fieldErrors, `translations.${locale}.shortDescription`) ? <em>{fieldErrorFor(fieldErrors, `translations.${locale}.shortDescription`)}</em> : null}</label>
            <div className="admin-field product-editor__wide">
              <label htmlFor={`long-description-${locale}`}>Long description (Markdown)</label>
              <textarea aria-invalid={fieldErrorFor(fieldErrors, `translations.${locale}.longDescriptionMarkdown`) !== undefined} id={`long-description-${locale}`} rows={9} value={translation.longDescriptionMarkdown ?? ""} onChange={(e) => updateTranslation("longDescriptionMarkdown", e.target.value)} />
              {fieldErrorFor(fieldErrors, `translations.${locale}.longDescriptionMarkdown`) ? <em>{fieldErrorFor(fieldErrors, `translations.${locale}.longDescriptionMarkdown`)}</em> : null}
              <button className="product-editor__preview-toggle" onClick={() => setPreviewMarkdown((value) => !value)} type="button">{previewMarkdown ? "Edit Markdown" : "Preview sanitized Markdown"}</button>
              {previewMarkdown ? <div className="product-markdown-preview" aria-label="Sanitized Markdown preview">{markdownPreview(translation.longDescriptionMarkdown ?? "")}</div> : null}
            </div>
            <label className="admin-field product-editor__wide"><span>Warranty information</span><textarea aria-invalid={fieldErrorFor(fieldErrors, `translations.${locale}.warrantyInformation`) !== undefined} rows={3} value={translation.warrantyInformation ?? ""} onChange={(e) => updateTranslation("warrantyInformation", e.target.value)} />{fieldErrorFor(fieldErrors, `translations.${locale}.warrantyInformation`) ? <em>{fieldErrorFor(fieldErrors, `translations.${locale}.warrantyInformation`)}</em> : null}</label>
            <div className="product-editor__wide">
              <ContentItemsEditor
                items={translation.features}
                label="Features"
                onChange={(items) => mutate((draft) => { const current = draft.translations[locale] ?? emptyTranslation(); draft.translations[locale] = { ...current, features: items as ProductFeature[] }; })}
              />
              <ContentItemsEditor
                items={translation.advantages}
                label="Advantages"
                onChange={(items) => mutate((draft) => { const current = draft.translations[locale] ?? emptyTranslation(); draft.translations[locale] = { ...current, advantages: items as ProductTextItem[] }; })}
              />
              <ContentItemsEditor
                items={translation.applications}
                label="Applications"
                onChange={(items) => mutate((draft) => { const current = draft.translations[locale] ?? emptyTranslation(); draft.translations[locale] = { ...current, applications: items as ProductTextItem[] }; })}
              />
            </div>
          </div>
        </fieldset>
        ) : null}

        {activeSection === "specifications" ? (
        <fieldset className="product-editor__panel" id="product-specifications">
          <legend>Specifications</legend>
          <p className="product-editor__muted">Add stable groups and items shared across locales. Labels remain localized in the selected language.</p>
          <div className="product-editor__nested-header"><strong>{state.specifications.length} groups</strong><button className="admin-button admin-button--quiet" onClick={() => mutate((draft) => { draft.specifications.push({ key: `group-${draft.specifications.length + 1}`, order: draft.specifications.length, translations: { [locale]: { label: "" } }, items: [] }); })} type="button">Add group</button></div>
          {state.specifications.map((group, groupIndex) => (
            <div className="product-editor__spec-group" key={`${group.key}-${groupIndex}`}>
              <div className="product-editor__nested-row">
                <input aria-label={`Specification group ${groupIndex + 1} key`} value={group.key} onChange={(e) => mutate((draft) => { const current = draft.specifications[groupIndex]; if (current) current.key = slugifyKey(e.target.value, `group-${groupIndex + 1}`); })} />
                <input aria-label={`Specification group ${groupIndex + 1} label`} placeholder="Group label" value={group.translations[locale]?.label ?? ""} onChange={(e) => mutate((draft) => { const current = draft.specifications[groupIndex]; if (current) current.translations[locale] = { label: e.target.value }; })} />
                <button aria-label={`Remove specification group ${groupIndex + 1}`} className="admin-button admin-button--quiet" onClick={() => mutate((draft) => { draft.specifications.splice(groupIndex, 1); })} type="button">Remove</button>
              </div>
              {group.items.map((item, itemIndex) => (
                <div className="product-editor__nested-row product-editor__nested-row--child" key={`${item.key}-${itemIndex}`}>
                  <input aria-label={`Specification ${groupIndex + 1} item ${itemIndex + 1} key`} value={item.key} onChange={(e) => mutate((draft) => { const groupDraft = draft.specifications[groupIndex]; const itemDraft = groupDraft?.items[itemIndex]; if (itemDraft) itemDraft.key = slugifyKey(e.target.value, `item-${itemIndex + 1}`); })} />
                  <input aria-label={`Specification ${groupIndex + 1} item ${itemIndex + 1} value`} placeholder="Value" value={item.value} onChange={(e) => mutate((draft) => { const itemDraft = draft.specifications[groupIndex]?.items[itemIndex]; if (itemDraft) itemDraft.value = e.target.value; })} />
                  <input aria-label={`Specification ${groupIndex + 1} item ${itemIndex + 1} unit`} placeholder="Unit" value={item.unit ?? ""} onChange={(e) => mutate((draft) => { const itemDraft = draft.specifications[groupIndex]?.items[itemIndex]; if (itemDraft) itemDraft.unit = e.target.value; })} />
                  <button aria-label={`Remove specification item ${itemIndex + 1}`} className="admin-button admin-button--quiet" onClick={() => mutate((draft) => { const groupDraft = draft.specifications[groupIndex]; if (groupDraft) groupDraft.items.splice(itemIndex, 1); })} type="button">Remove</button>
                </div>
              ))}
              <button className="product-editor__preview-toggle" onClick={() => mutate((draft) => { const current = draft.specifications[groupIndex]; if (current) current.items.push({ key: `item-${current.items.length + 1}`, order: current.items.length, value: "", translations: {} }); })} type="button">Add specification item</button>
            </div>
          ))}
        </fieldset>
        ) : null}

        {activeSection === "media" ? (
        <fieldset className="product-editor__panel" id="product-media">
          <legend>Media and downloads</legend>
          <p className="product-editor__muted">Assign reusable assets by role. Shared assets apply to every published locale unless a locale is selected.</p>
          <div className="product-editor__media-grid">
            {["hero", "gallery", "video", "backgroundVideo", "datasheet", "certificate", "brochure", "document", "openGraph"].map((role) => {
              const usage = state.mediaUsages.find((candidate) => candidate.role === role && candidate.locale === undefined);
              return <div className="product-editor__media-role" key={role}><div><strong>{role}</strong><small>{usage ? usage.mediaId : "Not assigned"}</small></div><button className="admin-button admin-button--quiet" onClick={() => setMediaPickerRole(role as typeof mediaPickerRole & string)} type="button">{usage ? "Replace" : "Choose"}</button></div>;
            })}
          </div>
        </fieldset>
        ) : null}

        {activeSection === "seo" ? (
        <fieldset className="product-editor__panel" id="product-seo">
          <legend>Localized SEO</legend>
          <div className="product-editor__grid">
            <label className="admin-field product-editor__wide"><span>SEO title</span><input aria-invalid={fieldErrorFor(fieldErrors, `translations.${locale}.seo.title`) !== undefined} value={translation.seo.title ?? ""} onChange={(e) => mutate((draft) => { const current = draft.translations[locale] ?? emptyTranslation(); draft.translations[locale] = { ...current, seo: { ...current.seo, title: e.target.value } }; })} />{fieldErrorFor(fieldErrors, `translations.${locale}.seo.title`) ? <em>{fieldErrorFor(fieldErrors, `translations.${locale}.seo.title`)}</em> : null}</label>
            <label className="admin-field product-editor__wide"><span>SEO description</span><textarea aria-invalid={fieldErrorFor(fieldErrors, `translations.${locale}.seo.description`) !== undefined} rows={3} value={translation.seo.description ?? ""} onChange={(e) => mutate((draft) => { const current = draft.translations[locale] ?? emptyTranslation(); draft.translations[locale] = { ...current, seo: { ...current.seo, description: e.target.value } }; })} />{fieldErrorFor(fieldErrors, `translations.${locale}.seo.description`) ? <em>{fieldErrorFor(fieldErrors, `translations.${locale}.seo.description`)}</em> : null}</label>
            <label className="admin-field"><span>Page template</span><select aria-invalid={fieldErrorFor(fieldErrors, "pageTemplate") !== undefined} value={state.pageTemplate} onChange={(e) => mutate((draft) => { draft.pageTemplate = e.target.value as EditorState["pageTemplate"]; })}><option value="standard">Standard</option><option value="topcon-premium">Topcon Premium</option></select><small>Templates are code-owned and validated by the API.</small>{fieldErrorFor(fieldErrors, "pageTemplate") ? <em>{fieldErrorFor(fieldErrors, "pageTemplate")}</em> : null}</label>
          </div>
        </fieldset>
        ) : null}

        {activeSection === "publication" ? (
        <fieldset className="product-editor__panel" id="product-publication">
          <legend>Publication</legend>
          <p className="product-editor__muted">Publication controls require a successful Save Draft and complete validation. English must publish before other locales.</p>
          <div className="product-editor__publication-state"><span>{languageByCode[locale]?.nativeLabel ?? locale.toUpperCase()}</span><strong>{localeState}</strong></div>
          <button className="admin-button" disabled={loaded === null || dirty || saving} onClick={() => void previewCurrent()} type="button">Preview Saved Draft</button>
          <div className="product-editor__publish-actions">
            <button className="admin-button admin-button--primary" disabled={loaded === null || dirty || saving || localeState === "incomplete"} onClick={() => void publishCurrent()} type="button">{loaded?.publishedSnapshots[locale] ? "Republish" : "Publish"} {languageByCode[locale]?.label ?? locale}</button>
            <button className="admin-button" disabled={loaded === null || dirty || saving || loaded?.publishedSnapshots[locale] === undefined} onClick={() => void unpublishCurrent()} type="button">Unpublish {languageByCode[locale]?.label ?? locale}</button>
            {loaded && loaded.status !== "archived" ? <button className="admin-button admin-button--danger" disabled={dirty || saving} onClick={() => void archiveCurrent()} type="button">Archive Product</button> : null}
          </div>
        </fieldset>
        ) : null}

        <div className="product-editor__step-actions">
          <button className="admin-button admin-button--quiet" disabled={activeSectionIndex === 0} onClick={() => { const previous = EDITOR_SECTIONS[activeSectionIndex - 1]; if (previous) setActiveSection(previous.id); }} type="button">Previous section</button>
          <span>Step {activeSectionIndex + 1} of {EDITOR_SECTIONS.length}</span>
          <button className="admin-button" disabled={activeSectionIndex === EDITOR_SECTIONS.length - 1} onClick={() => { const next = EDITOR_SECTIONS[activeSectionIndex + 1]; if (next) setActiveSection(next.id); }} type="button">Next section</button>
        </div>
      </form>

      <footer className="product-editor__footer">
        <span>{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <button className="admin-button admin-button--primary" disabled={!canSave} form="product-editor-form" type="submit">{saving ? "Saving..." : "Save Draft"}</button>
      </footer>
      {mediaPickerRole !== null ? <MediaPicker kind={mediaPickerRole === "video" || mediaPickerRole === "backgroundVideo" ? "video" : ["datasheet", "certificate", "brochure", "document"].includes(mediaPickerRole) ? "document" : "image"} onClose={() => setMediaPickerRole(null)} onSelect={assignMedia} {...(selectedMediaId === undefined ? {} : { selectedId: selectedMediaId })} title={`Choose ${mediaPickerRole} media`} /> : null}
    </section>
  );
}
