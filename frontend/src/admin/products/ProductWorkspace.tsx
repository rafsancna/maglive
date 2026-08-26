"use client";

import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALE_REGISTRY,
  type AdminProductListDto,
  type AdminProductListItem,
  type AdminProductListQuery,
  type CategoryAdminDto,
  type LocaleCode,
} from "@maglive/contracts";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AdminApiError } from "../auth/api";
import { listCategories } from "../categories/api";
import {
  archiveProduct,
  deleteProduct,
  duplicateProduct,
  listProducts,
  productListPath,
  publishProduct,
  unpublishProduct,
} from "./api";
import { parseProductListQuery } from "./query";

type WorkspaceError = Readonly<{
  kind: "conflict" | "session" | "unavailable" | "validation" | "operation";
  message: string;
}>;

function workspaceError(reason: unknown): WorkspaceError {
  if (!(reason instanceof AdminApiError)) {
    return {
      kind: "operation",
      message: "The Product operation failed unexpectedly.",
    };
  }
  if (reason.status === 401) {
    return {
      kind: "session",
      message: "Your administrator session has expired. Sign in again.",
    };
  }
  if (reason.status === 503 || reason.code === "API_UNAVAILABLE") {
    return {
      kind: "unavailable",
      message: "The CMS API is unavailable. No Product changes were made.",
    };
  }
  if (reason.code === "VERSION_CONFLICT") {
    return {
      kind: "conflict",
      message: "This Product changed elsewhere. Refresh the list and retry.",
    };
  }
  if (reason.code === "PRODUCT_NOT_PUBLISHABLE") {
    return {
      kind: "validation",
      message:
        "This locale is not publication-ready. Complete its required content in the Product editor first.",
    };
  }
  if (reason.code === "DEFAULT_LOCALE_REQUIRED") {
    return {
      kind: "validation",
      message: "Unpublish additional languages before unpublishing English.",
    };
  }
  return { kind: "operation", message: reason.message };
}

function stateLabel(value: string): string {
  return value.replaceAll("-", " ");
}

function categoryName(
  category: CategoryAdminDto | undefined,
  locale: LocaleCode,
): string {
  if (category === undefined) return "Unavailable category";
  return (
    category.translations[locale]?.name ??
    category.translations[DEFAULT_LOCALE]?.name ??
    category.slug
  );
}

function ProductActions({
  item,
  busy,
  onArchive,
  onDelete,
  onDuplicate,
  onPublish,
  onUnpublish,
}: {
  item: AdminProductListItem;
  busy: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onPublish: (locale: LocaleCode) => void;
  onUnpublish: (locale: LocaleCode) => void;
}) {
  const englishIsLive = item.publishedLocales.includes(DEFAULT_LOCALE);
  return (
    <details className="product-actions">
      <summary>Actions</summary>
      <div>
        <Link href={`/admin/products/${item.id}`}>Edit Product</Link>
        <button disabled type="button" title="Draft Preview is added in Phase 8">
          Preview unavailable
        </button>
        <button disabled={busy} onClick={onDuplicate} type="button">
          Duplicate as draft
        </button>
        <div className="product-actions__group">
          <strong>Publication</strong>
          {LOCALE_CODES.map((locale) => {
            const state = item.localeStates[locale];
            const blockedByEnglish =
              locale !== DEFAULT_LOCALE && !englishIsLive;
            return (
              <button
                disabled={
                  busy ||
                  item.status === "archived" ||
                  state === "incomplete" ||
                  blockedByEnglish
                }
                key={`publish-${locale}`}
                onClick={() => onPublish(locale)}
                title={
                  blockedByEnglish
                    ? "Publish English before additional languages"
                    : state === "incomplete"
                      ? "Required translation content is incomplete"
                      : undefined
                }
                type="button"
              >
                {item.publishedLocales.includes(locale)
                  ? `Republish ${LOCALE_REGISTRY[locale].label}`
                  : `Publish ${LOCALE_REGISTRY[locale].label}`}
              </button>
            );
          })}
          {item.publishedLocales.map((locale) => (
            <button
              disabled={
                busy ||
                (locale === DEFAULT_LOCALE && item.publishedLocales.length > 1)
              }
              key={`unpublish-${locale}`}
              onClick={() => onUnpublish(locale)}
              title={
                locale === DEFAULT_LOCALE && item.publishedLocales.length > 1
                  ? "Unpublish additional languages before English"
                  : undefined
              }
              type="button"
            >
              Unpublish {LOCALE_REGISTRY[locale].label}
            </button>
          ))}
        </div>
        {item.status === "archived" ? null : (
          <button disabled={busy} onClick={onArchive} type="button">
            Archive Product
          </button>
        )}
        {item.canDeletePermanently ? (
          <button
            className="product-actions__danger"
            disabled={busy}
            onClick={onDelete}
            type="button"
          >
            Permanently delete draft
          </button>
        ) : null}
      </div>
    </details>
  );
}

function ProductTable({
  categories,
  data,
  locale,
  busyId,
  onArchive,
  onDelete,
  onDuplicate,
  onPublish,
  onUnpublish,
}: {
  categories: ReadonlyMap<string, CategoryAdminDto>;
  data: AdminProductListDto;
  locale: LocaleCode;
  busyId: string | null;
  onArchive: (item: AdminProductListItem) => void;
  onDelete: (item: AdminProductListItem) => void;
  onDuplicate: (item: AdminProductListItem) => void;
  onPublish: (item: AdminProductListItem, locale: LocaleCode) => void;
  onUnpublish: (item: AdminProductListItem, locale: LocaleCode) => void;
}) {
  return (
    <div className="product-table-shell">
      <table className="product-table">
        <caption className="sr-only">Filtered administrator Products</caption>
        <thead>
          <tr>
            <th scope="col">Product</th>
            <th scope="col">Category</th>
            <th scope="col">Status</th>
            <th scope="col">Languages</th>
            <th scope="col">Updated</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.id}>
              <td data-label="Product">
                <div className="product-identity">
                  <strong>{item.name}</strong>
                  {item.nameLocale !== undefined && item.nameLocale !== locale ? (
                    <small>
                      Showing {LOCALE_REGISTRY[item.nameLocale].label} fallback
                    </small>
                  ) : null}
                  <code>{item.slug}</code>
                  <span>
                    {[item.model, item.series].filter(Boolean).join(" · ") ||
                      "No model or series"}
                  </span>
                  <small>
                    {LOCALE_CODES.map((candidate) =>
                      item.names[candidate] === undefined
                        ? `${candidate.toUpperCase()}: missing`
                        : `${candidate.toUpperCase()}: ${item.names[candidate]}`,
                    ).join(" · ")}
                  </small>
                </div>
              </td>
              <td data-label="Category">
                {categoryName(categories.get(item.categoryId), locale)}
              </td>
              <td data-label="Status">
                <div className="product-status-stack">
                  <span className={`product-badge product-badge--${item.status}`}>
                    {item.status}
                  </span>
                  <small>Shared: {stateLabel(item.sharedState)}</small>
                  {item.featured ? <small>Featured</small> : null}
                </div>
              </td>
              <td data-label="Languages">
                <div className="product-locale-states">
                  {LOCALE_CODES.map((candidate) => (
                    <span
                      className={`product-locale-state product-locale-state--${item.localeStates[candidate]}`}
                      key={candidate}
                    >
                      <b>{candidate.toUpperCase()}</b>
                      {stateLabel(item.localeStates[candidate])}
                    </span>
                  ))}
                </div>
              </td>
              <td data-label="Updated">
                <time dateTime={item.updatedAt}>
                  {new Intl.DateTimeFormat(LOCALE_REGISTRY[locale].languageTag, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(item.updatedAt))}
                </time>
              </td>
              <td data-label="Actions">
                <ProductActions
                  busy={busyId === item.id}
                  item={item}
                  onArchive={() => onArchive(item)}
                  onDelete={() => onDelete(item)}
                  onDuplicate={() => onDuplicate(item)}
                  onPublish={(candidate) => onPublish(item, candidate)}
                  onUnpublish={(candidate) => onUnpublish(item, candidate)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductWorkspace() {
  const router = useRouter();
  const searchParameters = useSearchParams();
  const queryKey = searchParameters.toString();
  const parsed = useMemo(
    () => parseProductListQuery(new URLSearchParams(queryKey)),
    [queryKey],
  );
  const [categories, setCategories] = useState<CategoryAdminDto[]>([]);
  const [data, setData] = useState<AdminProductListDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<WorkspaceError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loadedRequestKey, setLoadedRequestKey] = useState<string | null>(null);
  const requestKey = `${queryKey}::${refreshKey}`;
  const loading = parsed.success && loadedRequestKey !== requestKey;

  const categoriesById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  useEffect(() => {
    let active = true;
    void listCategories()
      .then((result) => {
        if (active) setCategories(result);
      })
      .catch((reason: unknown) => {
        if (active) setError(workspaceError(reason));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!parsed.success) return;
    let active = true;
    void listProducts(parsed.query)
      .then((result) => {
        if (!active) return;
        if (
          result.pagination.totalPages > 0 &&
          parsed.query.page > result.pagination.totalPages
        ) {
          router.replace(
            productListPath({
              ...parsed.query,
              page: result.pagination.totalPages,
            }),
            { scroll: false },
          );
          return;
        }
        setData(result);
        setError(null);
        setLoadedRequestKey(requestKey);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(workspaceError(reason));
          setLoadedRequestKey(requestKey);
        }
      });
    return () => {
      active = false;
    };
  }, [parsed, requestKey, router]);

  const navigate = useCallback(
    (mutate: (query: AdminProductListQuery) => void, resetPage = true) => {
      if (!parsed.success) return;
      const next = { ...parsed.query };
      mutate(next);
      if (resetPage) next.page = 1;
      router.push(productListPath(next), { scroll: false });
    },
    [parsed, router],
  );

  const refreshProducts = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  async function runAction(
    item: AdminProductListItem,
    action: () => Promise<unknown>,
    successMessage: string,
  ): Promise<void> {
    setBusyId(item.id);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(successMessage);
      refreshProducts();
    } catch (reason) {
      setError(workspaceError(reason));
    } finally {
      setBusyId(null);
    }
  }

  function duplicate(item: AdminProductListItem): void {
    if (!window.confirm(`Duplicate “${item.name}” as a new draft?`)) return;
    void runAction(
      item,
      () => duplicateProduct(item.id, item.version),
      "Product duplicated as a new draft.",
    );
  }

  function publish(item: AdminProductListItem, locale: LocaleCode): void {
    const promoteShared = item.sharedState === "changes-pending";
    const locales = promoteShared
      ? LOCALE_CODES.filter(
          (candidate) =>
            candidate === locale || item.publishedLocales.includes(candidate),
        )
      : [locale];
    const message = promoteShared
      ? `Shared Product fields changed. Republish ${locales.map((candidate) => LOCALE_REGISTRY[candidate].label).join(", ")} together?`
      : `${item.publishedLocales.includes(locale) ? "Republish" : "Publish"} ${LOCALE_REGISTRY[locale].label} for “${item.name}”?`;
    if (!window.confirm(message)) return;
    void runAction(
      item,
      () =>
        publishProduct(item.id, {
          version: item.version,
          locales,
          promoteShared,
        }),
      `${LOCALE_REGISTRY[locale].label} publication completed.`,
    );
  }

  function unpublish(item: AdminProductListItem, locale: LocaleCode): void {
    if (
      !window.confirm(
        `Unpublish ${LOCALE_REGISTRY[locale].label} for “${item.name}”? Its public URL will return 404.`,
      )
    ) {
      return;
    }
    void runAction(
      item,
      () => unpublishProduct(item.id, { version: item.version, locale }),
      `${LOCALE_REGISTRY[locale].label} was unpublished.`,
    );
  }

  function archive(item: AdminProductListItem): void {
    if (
      !window.confirm(
        `Archive “${item.name}”? Every published locale will become hidden.`,
      )
    ) {
      return;
    }
    void runAction(
      item,
      () => archiveProduct(item.id, item.version),
      "Product archived.",
    );
  }

  function remove(item: AdminProductListItem): void {
    if (
      !item.canDeletePermanently ||
      !window.confirm(
        `Permanently delete the never-published draft “${item.name}”? This cannot be undone.`,
      )
    ) {
      return;
    }
    void runAction(
      item,
      () => deleteProduct(item.id, item.version),
      "Draft Product permanently deleted.",
    );
  }

  if (!parsed.success) {
    return (
      <section className="product-workspace">
        <header className="product-workspace__header">
          <div>
            <span className="admin-kicker">Catalog operations</span>
            <h1>Products</h1>
          </div>
        </header>
        <div className="product-error-state" role="alert">
          <strong>Invalid Product list URL</strong>
          <p>{parsed.message}</p>
          <button
            className="admin-button admin-button--primary"
            onClick={() => router.replace("/admin/products")}
            type="button"
          >
            Reset filters
          </button>
        </div>
      </section>
    );
  }

  const query = parsed.query;
  return (
    <section className="product-workspace">
      <header className="product-workspace__header">
        <div>
          <span className="admin-kicker">Catalog operations</span>
          <h1>Products</h1>
          <p>
            Find multilingual Products, inspect publication readiness, and run
            protected lifecycle actions without loading the full catalog.
          </p>
        </div>
        <span className="product-workspace__phase-note">
          Product creation and editing arrive in PH06-02.
        </span>
      </header>

      {data === null ? null : (
        <div aria-label="Product totals" className="product-counts">
          {([
            ["All", data.collectionCounts.all],
            ["Draft", data.collectionCounts.draft],
            ["Published", data.collectionCounts.published],
            ["Archived", data.collectionCounts.archived],
            ["Featured", data.collectionCounts.featured],
          ] as const).map(([label, count]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{count}</strong>
            </div>
          ))}
        </div>
      )}

      <form
        className="product-filters"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          navigate((next) => {
            const value = new FormData(event.currentTarget).get("search");
            const search = typeof value === "string" ? value.trim() : "";
            if (search === "") delete next.search;
            else next.search = search;
          });
        }}
      >
        <label className="admin-field product-filters__search">
          <span>Search Products</span>
          <input
            defaultValue={query.search ?? ""}
            key={query.search ?? ""}
            maxLength={120}
            name="search"
            placeholder="Name, slug, model, or series"
            type="search"
          />
        </label>
        <button className="admin-button admin-button--primary" type="submit">
          Search
        </button>
        <label className="admin-field">
          <span>Category</span>
          <select
            onChange={(event) =>
              navigate((next) => {
                if (event.target.value === "") delete next.categoryId;
                else next.categoryId = event.target.value;
              })
            }
            value={query.categoryId ?? ""}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {categoryName(category, query.locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Global status</span>
          <select
            onChange={(event) =>
              navigate((next) => {
                const value = event.target.value;
                if (value === "") delete next.status;
                else next.status = value as AdminProductListQuery["status"];
              })
            }
            value={query.status ?? ""}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Language</span>
          <select
            onChange={(event) =>
              navigate((next) => {
                next.locale = event.target.value as LocaleCode;
              })
            }
            value={query.locale}
          >
            {LOCALE_CODES.map((locale) => (
              <option key={locale} value={locale}>
                {LOCALE_REGISTRY[locale].label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-field">
          <span>Language state</span>
          <select
            onChange={(event) =>
              navigate((next) => {
                const value = event.target.value;
                if (value === "") delete next.localeState;
                else {
                  next.localeState =
                    value as AdminProductListQuery["localeState"];
                }
              })
            }
            value={query.localeState ?? ""}
          >
            <option value="">All language states</option>
            <option value="incomplete">Incomplete</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="changes-pending">Changes pending</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Featured</span>
          <select
            onChange={(event) =>
              navigate((next) => {
                if (event.target.value === "") delete next.featured;
                else next.featured = event.target.value === "true";
              })
            }
            value={query.featured === undefined ? "" : String(query.featured)}
          >
            <option value="">All Products</option>
            <option value="true">Featured only</option>
            <option value="false">Not featured</option>
          </select>
        </label>
        <label className="admin-field">
          <span>Sort</span>
          <select
            onChange={(event) =>
              navigate((next) => {
                next.sort = event.target.value as AdminProductListQuery["sort"];
              })
            }
            value={query.sort}
          >
            <option value="updated-desc">Recently updated</option>
            <option value="updated-asc">Oldest updated</option>
            <option value="order-asc">Display order ascending</option>
            <option value="order-desc">Display order descending</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
        </label>
        <button
          className="admin-button admin-button--quiet product-filters__reset"
          onClick={() => router.push("/admin/products", { scroll: false })}
          type="button"
        >
          Reset
        </button>
      </form>

      {error === null ? null : (
        <div className={`product-error-state product-error-state--${error.kind}`} role="alert">
          <strong>
            {error.kind === "conflict"
              ? "Product changed"
              : error.kind === "session"
                ? "Session expired"
                : error.kind === "unavailable"
                  ? "API unavailable"
                  : error.kind === "validation"
                    ? "Publication blocked"
                    : "Product operation failed"}
          </strong>
          <p>{error.message}</p>
          {error.kind === "session" ? (
            <Link href={`/admin/login?returnTo=${encodeURIComponent(`/admin/products${queryKey === "" ? "" : `?${queryKey}`}`)}`}>
              Sign in again
            </Link>
          ) : (
            <button onClick={refreshProducts} type="button">
              Refresh Product list
            </button>
          )}
        </div>
      )}
      {notice === null ? null : (
        <div className="admin-notice" role="status">
          {notice}
        </div>
      )}

      {loading ? (
        <div aria-live="polite" className="product-loading">
          <span />
          <span />
          <span />
          Loading Products…
        </div>
      ) : null}
      {!loading && data !== null && data.items.length === 0 ? (
        <div className="product-empty">
          <strong>No Products match these filters</strong>
          <p>Change or reset the current URL-backed filters.</p>
        </div>
      ) : null}
      {!loading && data !== null && data.items.length > 0 ? (
        <ProductTable
          busyId={busyId}
          categories={categoriesById}
          data={data}
          locale={query.locale}
          onArchive={archive}
          onDelete={remove}
          onDuplicate={duplicate}
          onPublish={publish}
          onUnpublish={unpublish}
        />
      ) : null}

      {data === null ? null : (
        <nav aria-label="Product pages" className="product-pagination">
          <button
            disabled={loading || query.page <= 1}
            onClick={() =>
              navigate((next) => {
                next.page -= 1;
              }, false)
            }
            type="button"
          >
            Previous
          </button>
          <span>
            Page {query.page} of {Math.max(data.pagination.totalPages, 1)} · {data.pagination.total} Products
          </span>
          <button
            disabled={
              loading ||
              data.pagination.totalPages === 0 ||
              query.page >= data.pagination.totalPages
            }
            onClick={() =>
              navigate((next) => {
                next.page += 1;
              }, false)
            }
            type="button"
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
