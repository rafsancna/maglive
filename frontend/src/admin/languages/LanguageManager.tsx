"use client";

import type { CreateLanguageRequest } from "@maglive/contracts";
import { useState, type FormEvent } from "react";
import { AdminApiError } from "../auth/api";
import { AdminRouteIntro } from "../components/AdminRouteIntro";
import { addLanguage } from "./api";
import { useLanguages } from "./LanguageProvider";

const initialForm: CreateLanguageRequest = {
  code: "",
  languageTag: "",
  acceptLanguageAliases: [],
  direction: "ltr",
  fallback: "en",
  label: "",
  nativeLabel: "",
};

export function LanguageManager() {
  const { languages, loading, error, refresh } = useLanguages();
  const [form, setForm] = useState(initialForm);
  const [aliases, setAliases] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      const created = await addLanguage({
        ...form,
        code: form.code.trim().toLowerCase(),
        languageTag: form.languageTag.trim(),
        label: form.label.trim(),
        nativeLabel: form.nativeLabel.trim(),
        acceptLanguageAliases: aliases
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      });
      await refresh();
      setForm({ ...initialForm, fallback: "en" });
      setAliases("");
      setNotice(`${created.label} is now available in the CMS and public language switcher.`);
    } catch (reason) {
      setFormError(
        reason instanceof AdminApiError || reason instanceof Error
          ? reason.message
          : "The language could not be added.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminRouteIntro
      eyebrow="Localization"
      text="Add a language once, then translate and publish its category and product content from the existing editors. Code-owned site copy uses the selected fallback dictionary until a dedicated translation is deployed."
      title="Languages"
    >
      {error ? <p className="admin-alert admin-alert--error" role="alert">{error}</p> : null}
      {notice ? <p className="admin-alert admin-alert--success" role="status">{notice}</p> : null}

      <div className="admin-language-layout">
        <section className="admin-panel" aria-labelledby="enabled-languages-title">
          <div className="admin-panel__header">
            <div>
              <span className="admin-kicker">Registry</span>
              <h2 id="enabled-languages-title">Enabled languages</h2>
            </div>
            <span>{loading ? "Loading…" : `${languages.length} enabled`}</span>
          </div>
          <div className="admin-language-list">
            {languages.map((language) => (
              <article className="admin-language-card" key={language.code}>
                <div>
                  <strong lang={language.languageTag}>{language.nativeLabel}</strong>
                  <span>{language.label}</span>
                </div>
                <dl>
                  <div><dt>Route</dt><dd>/{language.code}</dd></div>
                  <div><dt>Language tag</dt><dd>{language.languageTag}</dd></div>
                  <div><dt>Direction</dt><dd>{language.direction.toUpperCase()}</dd></div>
                  <div><dt>Fallback</dt><dd>{language.fallback}</dd></div>
                </dl>
                {language.builtIn ? <small>Built-in language</small> : <small>Admin-added language</small>}
              </article>
            ))}
          </div>
        </section>

        <form className="admin-panel admin-language-form" onSubmit={(event) => void submit(event)}>
          <div className="admin-panel__header">
            <div>
              <span className="admin-kicker">New language</span>
              <h2>Add language</h2>
            </div>
          </div>
          {formError ? <p className="admin-alert admin-alert--error" role="alert">{formError}</p> : null}
          <label className="admin-field">
            <span>Route code</span>
            <input maxLength={24} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="fr" required value={form.code} />
            <small>Lowercase URL code, such as fr or pt-br.</small>
          </label>
          <label className="admin-field">
            <span>BCP 47 language tag</span>
            <input maxLength={64} onChange={(event) => setForm({ ...form, languageTag: event.target.value })} placeholder="fr-FR" required value={form.languageTag} />
          </label>
          <label className="admin-field">
            <span>English name</span>
            <input maxLength={80} onChange={(event) => setForm({ ...form, label: event.target.value })} placeholder="French" required value={form.label} />
          </label>
          <label className="admin-field">
            <span>Native name</span>
            <input maxLength={80} onChange={(event) => setForm({ ...form, nativeLabel: event.target.value })} placeholder="Français" required value={form.nativeLabel} />
          </label>
          <label className="admin-field">
            <span>Text direction</span>
            <select onChange={(event) => setForm({ ...form, direction: event.target.value as "ltr" | "rtl" })} value={form.direction}>
              <option value="ltr">Left to right</option>
              <option value="rtl">Right to left</option>
            </select>
          </label>
          <label className="admin-field">
            <span>Fallback language</span>
            <select onChange={(event) => setForm({ ...form, fallback: event.target.value })} value={form.fallback}>
              {languages.map((language) => <option key={language.code} value={language.code}>{language.label}</option>)}
            </select>
          </label>
          <label className="admin-field">
            <span>Accept-Language aliases</span>
            <input onChange={(event) => setAliases(event.target.value)} placeholder="fr-CA, fr-BE" value={aliases} />
            <small>Optional comma-separated browser language tags.</small>
          </label>
          <button className="admin-button admin-button--primary" disabled={saving || loading} type="submit">
            {saving ? "Adding language…" : "Add language"}
          </button>
        </form>
      </div>
    </AdminRouteIntro>
  );
}
