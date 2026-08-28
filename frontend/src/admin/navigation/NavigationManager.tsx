"use client";

import type {
  AdminMediaDto,
  NavigationAdminDto,
  NavigationCase,
  NavigationData,
  NavigationLink,
  NavigationNews,
  NavigationProduct,
  NavigationProductCategory,
  NavigationSolutionCategory,
  LocaleCode,
} from "@maglive/contracts";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminApiError } from "../auth/api";
import { MediaPicker } from "../media/MediaPicker";
import { getNavigation, updateNavigation } from "./api";

type Tab = "products" | "solutions" | "cases" | "news" | "documents" | "services";
type LocalizedField = "label" | "description" | "tag" | "alt" | "location" | "capacity" | "date" | "category";

const tabs: readonly { key: Tab; label: string; marker: string }[] = [
  { key: "products", label: "Products", marker: "01" },
  { key: "solutions", label: "Solutions", marker: "02" },
  { key: "cases", label: "Cases", marker: "03" },
  { key: "news", label: "News", marker: "04" },
  { key: "documents", label: "Documents", marker: "05" },
  { key: "services", label: "Services", marker: "06" },
];

function errorMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) return "The navigation operation failed unexpectedly.";
  if (error.code === "VERSION_CONFLICT") return "The navigation changed elsewhere. Refresh and retry.";
  if (error.code === "API_UNAVAILABLE") return "The CMS API is unavailable. Your edits are still in this browser.";
  return error.message;
}

function localizedValue(value: Readonly<Record<string, string>> | undefined, locale: LocaleCode): string {
  return value?.[locale] ?? "";
}

function setLocalized<T extends Readonly<Record<string, string>>>(value: T | undefined, locale: LocaleCode, next: string): T {
  return { ...(value ?? {}), [locale]: next } as T;
}

function newProduct(id: string): NavigationProduct {
  return { id, label: { en: "New product", zh: "新产品" }, description: { en: "Short product description", zh: "产品简短描述" }, href: "/products", tag: { en: "Featured", zh: "精选" }, visible: true, order: 0 };
}

function newCategory(id: string, accent: string): NavigationProductCategory {
  return { id, accent, label: { en: "New category", zh: "新分类" }, description: { en: "Category description", zh: "分类描述" }, href: "/products", products: [], visible: true, order: 0 };
}

function newLink(id: string): NavigationLink {
  return { id, label: { en: "New link", zh: "新链接" }, description: { en: "Link description", zh: "链接描述" }, href: "/", visible: true, order: 0 };
}

function updateItemField<T extends NavigationLink>(item: T, field: LocalizedField, locale: LocaleCode, value: string): T {
  if (field === "label" || field === "description" || field === "tag" || field === "alt" || field === "location" || field === "capacity" || field === "date" || field === "category") {
    return { ...item, [field]: setLocalized(item[field as keyof T] as Readonly<Record<string, string>> | undefined, locale, value) } as T;
  }
  return item;
}

function TextPair({ label, value, onChange }: { label: string; value: Readonly<Record<string, string>> | undefined; onChange: (locale: LocaleCode, value: string) => void }) {
  return <div className="admin-navigation__localized"><span>{label}</span><label><small>EN</small><input value={localizedValue(value, "en")} onChange={(event) => onChange("en", event.target.value)} /></label><label><small>中文</small><input value={localizedValue(value, "zh")} onChange={(event) => onChange("zh", event.target.value)} /></label></div>;
}

function ImageFields({ item, onChange }: { item: NavigationProduct; onChange: (next: NavigationProduct) => void }) {
  const image = item.image;
  const [pickerOpen, setPickerOpen] = useState(false);
  function selectMedia(media: AdminMediaDto): void {
    onChange({ ...item, image: { src: media.url, alt: image?.alt ?? item.label, width: media.width ?? image?.width ?? 1200, height: media.height ?? image?.height ?? 800, mediaId: media.id } });
    setPickerOpen(false);
  }
  return <fieldset className="admin-navigation__image-fields"><legend>Featured image</legend><div className="admin-navigation__image-actions"><button className="admin-button admin-button--quiet" onClick={() => setPickerOpen(true)} type="button">Choose from media library</button>{image?.mediaId ? <small>Linked media: {image.mediaId}</small> : null}</div><label className="admin-field"><span>Image URL</span><input placeholder="https://... or /uploads/..." value={image?.src ?? ""} onChange={(event) => onChange({ ...item, image: event.target.value.trim() === "" ? undefined : { src: event.target.value, alt: image?.alt ?? item.label, width: image?.width ?? 1200, height: image?.height ?? 800, ...(image?.mediaId === undefined ? {} : { mediaId: image.mediaId }) } })} /></label><TextPair label="Alt text" value={image?.alt} onChange={(locale, value) => onChange({ ...item, image: { src: image?.src ?? "/nav/solar.jpg", alt: setLocalized(image?.alt, locale, value), width: image?.width ?? 1200, height: image?.height ?? 800, ...(image?.mediaId === undefined ? {} : { mediaId: image.mediaId }) } })} />{pickerOpen ? <MediaPicker kind="image" onClose={() => setPickerOpen(false)} onSelect={selectMedia} title="Choose navigation image" {...(image?.mediaId === undefined ? {} : { selectedId: image.mediaId })} /> : null}</fieldset>;
}

function EntryFields({ item, onChange, showImage = false, extra, onRemove }: { item: NavigationProduct | NavigationLink; onChange: (next: typeof item) => void; showImage?: boolean; extra?: ReactNode; onRemove?: () => void }) {
  const product = item as NavigationProduct;
  return <div className="admin-navigation__entry-fields"><div className="admin-navigation__entry-top"><strong>{item.id}</strong><label className="admin-checkbox"><input checked={item.visible !== false} onChange={(event) => onChange({ ...item, visible: event.target.checked })} type="checkbox" /> Visible</label>{onRemove ? <button className="admin-button admin-button--quiet admin-navigation__remove" onClick={onRemove} type="button">Remove</button> : null}</div><div className="admin-navigation__localized-grid"><TextPair label="Label" value={item.label} onChange={(locale, value) => onChange(updateItemField(item, "label", locale, value))} /><TextPair label="Description" value={item.description} onChange={(locale, value) => onChange(updateItemField(item, "description", locale, value))} /></div><div className="admin-navigation__entry-grid"><label className="admin-field"><span>Link</span><input value={item.href} onChange={(event) => onChange({ ...item, href: event.target.value })} /></label><label className="admin-field"><span>Order</span><input min="0" type="number" value={item.order ?? 0} onChange={(event) => onChange({ ...item, order: Number(event.target.value) })} /></label></div>{showImage ? <><TextPair label="Tag" value={product.tag} onChange={(locale, value) => onChange(updateItemField(product, "tag", locale, value))} /><ImageFields item={product} onChange={(next) => onChange(next)} /></> : null}{extra}</div>;
}

function SectionHeader({ title, description, onAdd, addLabel }: { title: string; description: string; onAdd?: () => void; addLabel?: string }) {
  return <header className="admin-navigation__section-header"><div><span className="admin-kicker">Menu content</span><h2>{title}</h2><p>{description}</p></div>{onAdd && addLabel ? <button className="admin-button admin-button--primary" onClick={onAdd} type="button">+ {addLabel}</button> : null}</header>;
}

export function NavigationManager() {
  const [data, setData] = useState<NavigationAdminDto | null>(null);
  const [tab, setTab] = useState<Tab>("products");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getNavigation().then((result) => { if (active) setData(result); }).catch((reason: unknown) => { if (active) setError(errorMessage(reason)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const itemCount = useMemo(() => data === null ? 0 : data.productCategories.length + data.featuredProducts.length + data.solutionCategories.length + data.cases.length + data.news.length + data.documents.length + data.services.length, [data]);

  function change(next: NavigationAdminDto): void { setData(next); setDirty(true); setNotice(null); setError(null); }

  async function save(): Promise<void> {
    if (data === null) return;
    setBusy(true); setError(null); setNotice(null);
    try { const saved = await updateNavigation(data); setData(saved); setDirty(false); setNotice("Navigation content saved and is ready for the public menu."); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); }
  }

  function updateCategory(id: string, next: NavigationProductCategory): void { if (data === null) return; change({ ...data, productCategories: data.productCategories.map((item) => item.id === id ? next : item) }); }
  function updateCategoryProduct(categoryId: string, productId: string, next: NavigationProduct): void { if (data === null) return; updateCategory(categoryId, { ...data.productCategories.find((item) => item.id === categoryId)!, products: data.productCategories.find((item) => item.id === categoryId)!.products.map((item) => item.id === productId ? next : item) }); }
  function updateSolution(id: string, next: NavigationSolutionCategory): void { if (data === null) return; change({ ...data, solutionCategories: data.solutionCategories.map((item) => item.id === id ? next : item) }); }
  function updateProduct(id: string, next: NavigationProduct): void { if (data === null) return; change({ ...data, featuredProducts: data.featuredProducts.map((item) => item.id === id ? next : item) }); }
  function updateList<K extends "cases" | "news" | "documents" | "services">(key: K, id: string, next: NavigationData[K][number]): void { if (data === null) return; change({ ...data, [key]: data[key].map((item) => item.id === id ? next : item) } as NavigationAdminDto); }
  function removeList<K extends "cases" | "news" | "documents" | "services">(key: K, id: string): void { if (data === null) return; change({ ...data, [key]: data[key].filter((item) => item.id !== id) } as NavigationAdminDto); }

  if (loading) return <section className="admin-route"><div className="admin-navigation__loading">Loading navigation settings…</div></section>;
  if (data === null) return <section className="admin-route"><div className="admin-alert" role="alert">{error ?? "Navigation settings could not be loaded."}</div></section>;

  return <section className="admin-route admin-navigation"><header className="admin-route__heading"><span className="admin-kicker">Navigation control</span><h1>Navbar &amp; mega menu</h1><p>Manage the content, links, order, visibility, and imagery used by the public navigation. The layout and interaction remain code-owned.</p></header><div className="admin-navigation__toolbar"><div><strong>{itemCount}</strong><span>managed menu records</span>{dirty ? <em>Unsaved changes</em> : null}</div><button className="admin-button admin-button--primary" disabled={busy || !dirty} onClick={() => void save()} type="button">{busy ? "Saving…" : "Save navigation"}</button></div>{error ? <div className="admin-alert" role="alert">{error}</div> : null}{notice ? <div className="admin-alert admin-alert--success" role="status">{notice}</div> : null}<nav aria-label="Navigation settings" className="admin-navigation__tabs">{tabs.map((item) => <button aria-current={tab === item.key ? "page" : undefined} className={tab === item.key ? "is-active" : ""} key={item.key} onClick={() => setTab(item.key)} type="button"><span>{item.marker}</span>{item.label}<small>{item.key === "products" ? data.productCategories.length : item.key === "solutions" ? data.solutionCategories.length : data[item.key].length}</small></button>)}</nav>{tab === "products" ? <ProductsEditor data={data} onChange={change} onCategoryChange={updateCategory} onCategoryProductChange={updateCategoryProduct} onProductChange={updateProduct} /> : null}{tab === "solutions" ? <SolutionsEditor data={data} onChange={change} onSolutionChange={updateSolution} /> : null}{tab === "cases" ? <SimpleListEditor items={data.cases} title="Cases" description="Projects shown in the visual Cases menu." onAdd={() => change({ ...data, cases: [...data.cases, { ...newProduct(`case-${Date.now()}`), location: { en: "Project location", zh: "项目地点" }, capacity: { en: "0 MWp", zh: "0 MWp" } }] })} onChange={(id, next) => updateList("cases", id, next as NavigationCase)} onRemove={(id) => removeList("cases", id)} showImage /> : null}{tab === "news" ? <SimpleListEditor items={data.news} title="News" description="Latest articles shown in the News menu." onAdd={() => change({ ...data, news: [...data.news, { ...newProduct(`news-${Date.now()}`), date: { en: "01 Jan 2025", zh: "2025年1月1日" }, category: { en: "Company", zh: "公司" } }] })} onChange={(id, next) => updateList("news", id, next as NavigationNews)} onRemove={(id) => removeList("news", id)} showImage /> : null}{tab === "documents" ? <SimpleListEditor items={data.documents} title="Documents" description="Download and resource links shown in the Documents menu." onAdd={() => change({ ...data, documents: [...data.documents, newLink(`document-${Date.now()}`)] })} onChange={(id, next) => updateList("documents", id, next)} onRemove={(id) => removeList("documents", id)} /> : null}{tab === "services" ? <SimpleListEditor items={data.services} title="Services" description="Support and service links shown in the Services menu." onAdd={() => change({ ...data, services: [...data.services, newLink(`service-${Date.now()}`)] })} onChange={(id, next) => updateList("services", id, next)} onRemove={(id) => removeList("services", id)} /> : null}</section>;
}

function ProductsEditor({ data, onChange, onCategoryChange, onCategoryProductChange, onProductChange }: { data: NavigationAdminDto; onChange: (next: NavigationAdminDto) => void; onCategoryChange: (id: string, next: NavigationProductCategory) => void; onCategoryProductChange: (categoryId: string, productId: string, next: NavigationProduct) => void; onProductChange: (id: string, next: NavigationProduct) => void }) {
  return <div className="admin-navigation__content"><SectionHeader title="Products" description="Each category controls the cards that appear in the right panel when a visitor hovers it." onAdd={() => onChange({ ...data, productCategories: [...data.productCategories, newCategory(`category-${Date.now()}`, String(data.productCategories.length + 1).padStart(2, "0"))] })} addLabel="Add category" /><div className="admin-navigation__cards">{data.productCategories.map((category) => <article className="admin-navigation__card" key={category.id}><EntryFields item={category} onChange={(next) => onCategoryChange(category.id, next as NavigationProductCategory)} extra={<div className="admin-navigation__nested"><div className="admin-navigation__nested-head"><strong>Products on hover</strong><button className="admin-button admin-button--quiet" onClick={() => onCategoryChange(category.id, { ...category, products: [...category.products, newProduct(`${category.id}-product-${Date.now()}`)] })} type="button">+ Add product</button></div>{category.products.map((item) => <div className="admin-navigation__nested-item" key={item.id}><EntryFields item={item} onChange={(next) => onCategoryProductChange(category.id, item.id, next as NavigationProduct)} showImage /></div>)}</div>} /></article>)}</div><SectionHeader title="Featured products" description="Fallback and globally featured product cards used when a category has no hover cards." onAdd={() => onChange({ ...data, featuredProducts: [...data.featuredProducts, newProduct(`featured-${Date.now()}`)] })} addLabel="Add product" /><div className="admin-navigation__cards">{data.featuredProducts.map((item) => <article className="admin-navigation__card" key={item.id}><EntryFields item={item} onChange={(next) => onProductChange(item.id, next as NavigationProduct)} showImage /></article>)}</div></div>;
}

function SolutionsEditor({ data, onChange, onSolutionChange }: { data: NavigationAdminDto; onChange: (next: NavigationAdminDto) => void; onSolutionChange: (id: string, next: NavigationSolutionCategory) => void }) {
  return <div className="admin-navigation__content"><SectionHeader title="Solutions" description="Each solution category controls the feature card displayed on the right when it is hovered." onAdd={() => onChange({ ...data, solutionCategories: [...data.solutionCategories, { ...newLink(`solution-${Date.now()}`), feature: undefined }] })} addLabel="Add solution" /><div className="admin-navigation__cards">{data.solutionCategories.map((item) => <article className="admin-navigation__card" key={item.id}><EntryFields item={item} onChange={(next) => onSolutionChange(item.id, next as NavigationSolutionCategory)} extra={<div className="admin-navigation__nested"><div className="admin-navigation__nested-head"><strong>Hover feature card</strong>{item.feature ? <span className="admin-navigation__configured">Configured</span> : <button className="admin-button admin-button--quiet" onClick={() => onSolutionChange(item.id, { ...item, feature: newProduct(`${item.id}-feature`) })} type="button">+ Add feature</button>}</div>{item.feature ? <EntryFields item={item.feature} onChange={(next) => onSolutionChange(item.id, { ...item, feature: next as NavigationProduct })} showImage /> : <p className="admin-navigation__empty">No feature card configured. The frontend will use the global fallback.</p>}</div>} /></article>)}</div><SectionHeader title="Global solution fallback" description="Used if a solution category does not have its own feature card." /><article className="admin-navigation__card"><EntryFields item={data.featuredSolution} onChange={(next) => onChange({ ...data, featuredSolution: next as NavigationProduct })} showImage /></article></div>;
}

function SimpleListEditor<T extends NavigationProduct | NavigationLink>({ items, title, description, onAdd, onChange, onRemove, showImage = false }: { items: readonly T[]; title: string; description: string; onAdd: () => void; onChange: (id: string, next: T) => void; onRemove: (id: string) => void; showImage?: boolean }) {
  return <div className="admin-navigation__content"><SectionHeader title={title} description={description} onAdd={onAdd} addLabel={`Add ${title.toLowerCase().replace(/s$/, "")}`} /><div className="admin-navigation__cards">{items.map((item) => <article className="admin-navigation__card" key={item.id}><EntryFields item={item} onChange={(next) => onChange(item.id, next as T)} onRemove={() => onRemove(item.id)} showImage={showImage} extra={"location" in item ? <div className="admin-navigation__entry-grid"><TextPair label="Location" value={(item as NavigationCase).location} onChange={(locale, value) => onChange(item.id, { ...item, location: setLocalized((item as NavigationCase).location, locale, value) } as T)} /><TextPair label="Capacity" value={(item as NavigationCase).capacity} onChange={(locale, value) => onChange(item.id, { ...item, capacity: setLocalized((item as NavigationCase).capacity, locale, value) } as T)} /></div> : "date" in item ? <div className="admin-navigation__entry-grid"><TextPair label="Date" value={(item as NavigationNews).date} onChange={(locale, value) => onChange(item.id, { ...item, date: setLocalized((item as NavigationNews).date, locale, value) } as T)} /><TextPair label="Category" value={(item as NavigationNews).category} onChange={(locale, value) => onChange(item.id, { ...item, category: setLocalized((item as NavigationNews).category, locale, value) } as T)} /></div> : undefined} /></article>)}</div></div>;
}
