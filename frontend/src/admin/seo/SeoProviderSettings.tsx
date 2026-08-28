"use client";

import type {
  SeoConnectionProvider,
  SeoProviderCredentials,
  SeoProviderSettings as SeoProviderSettingsDto,
  SeoProviderSettingsResponse,
} from "@maglive/contracts";
import { useEffect, useMemo, useState } from "react";
import { AdminApiError } from "../auth/api";
import {
  getSeoProviderSettings,
  saveSeoProviderSettings,
  testSeoProviderConnection,
} from "./api";

const definitions: readonly { provider: SeoConnectionProvider; label: string; fields: readonly { key: keyof SeoProviderCredentials; label: string; secret?: boolean; multiline?: boolean }[] }[] = [
  { provider: "google", label: "Google Search Console", fields: [
    { key: "site", label: "Search Console property" },
    { key: "clientEmail", label: "Service account email" },
    { key: "privateKey", label: "Service account private key", secret: true, multiline: true },
  ] },
  { provider: "bing", label: "Bing Webmaster", fields: [{ key: "site", label: "Verified site" }, { key: "apiKey", label: "Webmaster API key", secret: true }] },
  { provider: "baidu", label: "Baidu Search Resource Platform", fields: [{ key: "site", label: "Verified site" }, { key: "token", label: "Submission token", secret: true }] },
  { provider: "yandex", label: "Yandex Webmaster", fields: [{ key: "site", label: "Verified site" }, { key: "token", label: "OAuth token", secret: true }] },
  { provider: "indexnow", label: "IndexNow", fields: [{ key: "key", label: "IndexNow key", secret: true }, { key: "keyLocation", label: "Hosted key URL" }] },
];

type Drafts = Record<SeoConnectionProvider, SeoProviderCredentials>;

const emptyDrafts = (): Drafts => ({ google: {}, bing: {}, baidu: {}, yandex: {}, indexnow: {} });

function cleanCredentials(value: SeoProviderCredentials): SeoProviderCredentials {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => typeof item === "string" && item.trim() !== "")) as SeoProviderCredentials;
}

export function SeoProviderSettings() {
  const [settings, setSettings] = useState<SeoProviderSettingsResponse>();
  const [drafts, setDrafts] = useState<Drafts>(() => emptyDrafts());
  const [enabled, setEnabled] = useState<Record<SeoConnectionProvider, boolean>>({ google: true, bing: true, baidu: true, yandex: true, indexnow: true });
  const [busy, setBusy] = useState<SeoConnectionProvider>();
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    let active = true;
    void getSeoProviderSettings().then((result) => {
      if (!active) return;
      setSettings(result);
      setEnabled(Object.fromEntries(result.providers.map((item) => [item.provider, item.enabled])) as Record<SeoConnectionProvider, boolean>);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof AdminApiError ? reason.message : "Provider settings could not be loaded.");
    });
    return () => { active = false; };
  }, [refreshToken]);

  const byProvider = useMemo(() => new Map(settings?.providers.map((item) => [item.provider, item]) ?? []), [settings]);

  function updateDraft(provider: SeoConnectionProvider, key: keyof SeoProviderCredentials, value: string): void {
    setDrafts((current) => ({ ...current, [provider]: { ...current[provider], [key]: value } }));
    setNotice(undefined);
  }

  async function save(provider: SeoConnectionProvider): Promise<void> {
    setBusy(provider);
    setError(undefined);
    try {
      const result = await saveSeoProviderSettings(provider, cleanCredentials(drafts[provider]), enabled[provider]);
      setSettings((current) => current === undefined ? current : { providers: current.providers.map((item) => item.provider === provider ? result : item) });
      setNotice(`${definitions.find((item) => item.provider === provider)?.label ?? provider} settings saved.`);
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Provider settings could not be saved.");
    } finally {
      setBusy(undefined);
    }
  }

  async function test(provider: SeoConnectionProvider): Promise<void> {
    setBusy(provider);
    setError(undefined);
    try {
      const result = await testSeoProviderConnection(provider);
      setSettings((current) => current === undefined ? current : { providers: current.providers.map((item) => item.provider === provider ? result : item) });
      setNotice(result.message);
    } catch (reason) {
      setError(reason instanceof AdminApiError ? reason.message : "Provider connection check failed.");
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section className="seo-dashboard__section seo-provider-settings" aria-labelledby="seo-provider-settings-title">
      <div className="seo-provider-settings__heading"><div><span className="admin-kicker">Connections</span><h2 id="seo-provider-settings-title">Search provider APIs</h2><p>Credentials are encrypted on the server and never returned to this browser. Blank secret fields keep the saved secret.</p></div><button className="admin-button admin-button--quiet" disabled={busy !== undefined} onClick={() => setRefreshToken((value) => value + 1)} type="button">Refresh status</button></div>
      {notice ? <div className="admin-alert admin-alert--success" role="status">{notice}</div> : null}
      {error ? <div className="admin-alert" role="alert">{error}</div> : null}
      <div className="seo-provider-grid">
        {definitions.map((definition) => {
          const item: SeoProviderSettingsDto | undefined = byProvider.get(definition.provider);
          return <article className="seo-provider-card" key={definition.provider}>
            <div className="seo-provider-card__header"><div><span className="admin-kicker">{definition.provider}</span><h3>{definition.label}</h3></div><span className={`seo-provider-status seo-provider-status--${item?.status ?? "not-configured"}`}>{item?.status ?? "not-configured"}</span></div>
            {item?.site ? <p className="seo-provider-card__site">{item.site}</p> : null}
            <label className="admin-check"><input checked={enabled[definition.provider]} onChange={(event) => setEnabled((current) => ({ ...current, [definition.provider]: event.target.checked }))} type="checkbox" /> Enable provider</label>
            <div className="seo-provider-card__fields">
              {definition.fields.map((field) => field.multiline ? <label className="admin-field" key={field.key}><span>{field.label}</span><textarea rows={4} value={String(drafts[definition.provider][field.key] ?? "")} onChange={(event) => updateDraft(definition.provider, field.key, event.target.value)} /></label> : <label className="admin-field" key={field.key}><span>{field.label}{field.secret ? " (leave blank to keep saved)" : ""}</span><input type={field.secret ? "password" : field.key === "site" || field.key === "keyLocation" ? "url" : "text"} value={String(drafts[definition.provider][field.key] ?? "")} onChange={(event) => updateDraft(definition.provider, field.key, event.target.value)} /></label>)}
            </div>
            <div className="seo-provider-card__actions"><button className="admin-button admin-button--primary" disabled={busy !== undefined} onClick={() => void save(definition.provider)} type="button">{busy === definition.provider ? "Saving..." : "Save settings"}</button><button className="admin-button admin-button--quiet" disabled={busy !== undefined || !item?.configured} onClick={() => void test(definition.provider)} type="button">Test connection</button></div>
            <p className="seo-provider-card__message">{item?.message ?? "No credentials configured."}{item?.lastCheckedAt ? ` Last checked ${new Date(item.lastCheckedAt).toLocaleString()}.` : ""}</p>
          </article>;
        })}
      </div>
    </section>
  );
}
