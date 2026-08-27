"use client";

import {
  DEFAULT_LOCALE,
  type CategoryAdminDto,
  type CreateProductRequest,
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
  return errors[path] ?? errors[`translations.${path}`];
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
  const [locale, setLocale] = useState<LocaleCode>(DEFAULT_LOCALE);
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
        if (active) setCategories(items.filter((item) => item.status === "active"));
      })
      .catch(() => {
        if (active) setCategories([]);
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
    });
  }

  async function save(): Promise<void> {
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
        setFieldErrors(
          Object.fromEntries(reason.details.map((detail) => [detail.path, detail.message])),
        );
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
        setFieldErrors(Object.fromEntries(reason.details.map((detail) => [detail.path, detail.message])));
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
          <button className="admin-button admin-button--primary" disabled={saving} onClick={() => void save()} type="button">
            {saving ? "Saving..." : "Save Draft"}
          </button>
        </div>
      </header>

      {notice ? <div className="admin-alert admin-alert--success" role="status">{notice}</div> : null}
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}

      <nav aria-label="Product editor sections" className="product-editor__sections">
        {["basic", "content", "specifications", "media", "seo", "publication"].map((id) => (
          <a href={`#product-${id}`} key={id}>{id}</a>
        ))}
      </nav>

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

      <div className="product-editor__body">
        <fieldset className="product-editor__panel" id="product-basic">
          <legend>Basic information</legend>
          <div className="product-editor__grid">
            <label className="admin-field"><span>Canonical slug</span><input value={state.slug} onChange={(e) => mutate((draft) => { draft.slug = e.target.value; })} /><small>Lowercase ASCII; locked after first publication.</small>{fieldErrorFor(fieldErrors, "slug") ? <em>{fieldErrorFor(fieldErrors, "slug")}</em> : null}</label>
            <label className="admin-field"><span>Category</span><select value={state.categoryId} onChange={(e) => mutate((draft) => { draft.categoryId = e.target.value; })}><option value="">Select a leaf category</option>{categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.translations[locale]?.name ?? category.translations.en?.name ?? category.slug}</option>)}</select>{fieldErrorFor(fieldErrors, "categoryId") ? <em>{fieldErrorFor(fieldErrors, "categoryId")}</em> : null}</label>
            <label className="admin-field"><span>Model</span><input value={state.model ?? ""} onChange={(e) => mutate((draft) => { draft.model = e.target.value; })} /></label>
            <label className="admin-field"><span>Series</span><input value={state.series ?? ""} onChange={(e) => mutate((draft) => { draft.series = e.target.value; })} /></label>
            <label className="admin-field"><span>Display order</span><input min={0} type="number" value={state.displayOrder} onChange={(e) => mutate((draft) => { draft.displayOrder = Number(e.target.value); })} /></label>
            <label className="admin-checkbox"><input checked={state.featured} onChange={(e) => mutate((draft) => { draft.featured = e.target.checked; })} type="checkbox" /><span>Feature this Product in catalog listings</span></label>
          </div>
        </fieldset>

        <fieldset className="product-editor__panel" id="product-content">
          <legend>{languageByCode[locale]?.nativeLabel ?? locale.toUpperCase()} content</legend>
          <div className="product-editor__grid">
            <label className="admin-field product-editor__wide"><span>Name</span><input value={translation.name} onChange={(e) => updateTranslation("name", e.target.value)} />{fieldErrorFor(fieldErrors, `translations.${locale}.name`) ? <em>{fieldErrorFor(fieldErrors, `translations.${locale}.name`)}</em> : null}</label>
            <label className="admin-field product-editor__wide"><span>Short description</span><textarea rows={3} value={translation.shortDescription ?? ""} onChange={(e) => updateTranslation("shortDescription", e.target.value)} /></label>
            <div className="admin-field product-editor__wide">
              <label htmlFor={`long-description-${locale}`}>Long description (Markdown)</label>
              <textarea id={`long-description-${locale}`} rows={9} value={translation.longDescriptionMarkdown ?? ""} onChange={(e) => updateTranslation("longDescriptionMarkdown", e.target.value)} />
              <button className="product-editor__preview-toggle" onClick={() => setPreviewMarkdown((value) => !value)} type="button">{previewMarkdown ? "Edit Markdown" : "Preview sanitized Markdown"}</button>
              {previewMarkdown ? <div className="product-markdown-preview" aria-label="Sanitized Markdown preview">{markdownPreview(translation.longDescriptionMarkdown ?? "")}</div> : null}
            </div>
            <label className="admin-field product-editor__wide"><span>Warranty information</span><textarea rows={3} value={translation.warrantyInformation ?? ""} onChange={(e) => updateTranslation("warrantyInformation", e.target.value)} /></label>
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

        <fieldset className="product-editor__panel" id="product-seo">
          <legend>Localized SEO</legend>
          <div className="product-editor__grid">
            <label className="admin-field product-editor__wide"><span>SEO title</span><input value={translation.seo.title ?? ""} onChange={(e) => mutate((draft) => { const current = draft.translations[locale] ?? emptyTranslation(); draft.translations[locale] = { ...current, seo: { ...current.seo, title: e.target.value } }; })} /></label>
            <label className="admin-field product-editor__wide"><span>SEO description</span><textarea rows={3} value={translation.seo.description ?? ""} onChange={(e) => mutate((draft) => { const current = draft.translations[locale] ?? emptyTranslation(); draft.translations[locale] = { ...current, seo: { ...current.seo, description: e.target.value } }; })} /></label>
            <label className="admin-field"><span>Page template</span><select value={state.pageTemplate} onChange={(e) => mutate((draft) => { draft.pageTemplate = e.target.value as EditorState["pageTemplate"]; })}><option value="standard">Standard</option><option value="topcon-premium">Topcon Premium</option></select><small>Templates are code-owned and validated by the API.</small></label>
          </div>
        </fieldset>

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
      </div>

      <footer className="product-editor__footer">
        <span>{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <button className="admin-button admin-button--primary" disabled={saving || !dirty} onClick={() => void save()} type="button">{saving ? "Saving..." : "Save Draft"}</button>
      </footer>
      {mediaPickerRole !== null ? <MediaPicker kind={mediaPickerRole === "video" || mediaPickerRole === "backgroundVideo" ? "video" : ["datasheet", "certificate", "brochure", "document"].includes(mediaPickerRole) ? "document" : "image"} onClose={() => setMediaPickerRole(null)} onSelect={assignMedia} {...(selectedMediaId === undefined ? {} : { selectedId: selectedMediaId })} title={`Choose ${mediaPickerRole} media`} /> : null}
    </section>
  );
}
