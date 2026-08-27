"use client";

import { useState, type FormEvent } from "react";
import { AdminApiError } from "../auth/api";
import { AdminRouteIntro } from "../components/AdminRouteIntro";
import { addLanguage } from "./api";
import { useLanguages } from "./LanguageProvider";
import { LANGUAGE_PRESETS, getLanguagePreset } from "./presets";

export function LanguageManager() {
  const { languages, loading, error, refresh } = useLanguages();
  const [selectedCode, setSelectedCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const selectedPreset = getLanguagePreset(selectedCode);
  const enabledCodes = new Set(languages.map(({ code }) => code));

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    setNotice(null);
    try {
      if (selectedPreset === undefined) {
        setFormError("Choose a language first.");
        return;
      }
      const created = await addLanguage(selectedPreset.request);
      await refresh();
      setSelectedCode("");
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
      text="Choose a language and add it in one step. Everything else is configured automatically."
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
                <div className="admin-language-card__identity">
                  <span aria-hidden="true" className="admin-language-flag">
                    {getLanguagePreset(language.code)?.flag ?? "🌐"}
                  </span>
                  <div>
                    <strong lang={language.languageTag}>{language.nativeLabel}</strong>
                    <span>{language.label}</span>
                  </div>
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
            <span>Language</span>
            <select
              aria-label="Language"
              onChange={(event) => {
                setSelectedCode(event.target.value);
                setFormError(null);
                setNotice(null);
              }}
              required
              value={selectedCode}
            >
              <option value="">Choose a language</option>
              {LANGUAGE_PRESETS.map(({ flag, request }) => (
                <option
                  disabled={enabledCodes.has(request.code)}
                  key={request.code}
                  value={request.code}
                >
                  {flag} {request.nativeLabel} — {request.label}{enabledCodes.has(request.code) ? " (already enabled)" : ""}
                </option>
              ))}
            </select>
            <small>The technical settings are predefined and added automatically.</small>
          </label>

          {selectedPreset ? (
            <div className="admin-language-selection" aria-live="polite">
              <span aria-hidden="true" className="admin-language-selection__flag">{selectedPreset.flag}</span>
              <div>
                <strong lang={selectedPreset.request.languageTag}>{selectedPreset.request.nativeLabel}</strong>
                <span>{selectedPreset.request.label}</span>
                <small>
                  Route /{selectedPreset.request.code} · {selectedPreset.request.languageTag} · {selectedPreset.request.direction.toUpperCase()}
                </small>
              </div>
            </div>
          ) : null}

          <button className="admin-button admin-button--primary" disabled={saving || loading || selectedPreset === undefined} type="submit">
            {saving ? "Adding language…" : selectedPreset ? `Add ${selectedPreset.request.label}` : "Add language"}
          </button>
        </form>
      </div>
    </AdminRouteIntro>
  );
}
