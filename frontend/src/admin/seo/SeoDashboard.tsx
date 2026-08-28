"use client";

import type { SeoDashboardSummary } from "@maglive/contracts";
import { useEffect, useState } from "react";
import { AdminApiError } from "../auth/api";
import { getSeoDashboardSummary } from "./api";
import { SeoProviderSettings } from "./SeoProviderSettings";

export function SeoDashboard() {
  const [summary, setSummary] = useState<SeoDashboardSummary>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    void getSeoDashboardSummary().then((result) => {
      if (active) setSummary(result);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof AdminApiError ? reason.message : "The SEO dashboard could not be loaded.");
    });
    return () => { active = false; };
  }, []);
  if (error) return <div className="seo-dashboard"><div className="admin-alert" role="alert">{error}</div><SeoProviderSettings /></div>;
  if (!summary) return <div className="seo-dashboard"><p aria-live="polite">Loading SEO health...</p><SeoProviderSettings /></div>;
  return (
    <div className="seo-dashboard">
      <div className="admin-module-grid">
        <article className="admin-module-card"><span>Overall health</span><h2>{summary.averageScore} / 100</h2><p>Average score across published Product and Category locales.</p></article>
        <article className="admin-module-card"><span>Critical issues</span><h2>{summary.criticalIssues}</h2><p>Resolve these before relying on a page as indexable.</p></article>
        <article className="admin-module-card"><span>Missing descriptions</span><h2>{summary.missingMetaDescriptions}</h2><p>Published locales without a meta description.</p></article>
        <article className="admin-module-card"><span>Missing ALT text</span><h2>{summary.missingAltText}</h2><p>Published entities with image accessibility gaps.</p></article>
      </div>
      <section className="seo-dashboard__section">
        <h2>Scores by content type</h2>
        <div className="admin-module-grid">
          {Object.entries(summary.byContentType).map(([type, score]) => <article className="admin-module-card" key={type}><span>{type}</span><h2>{score} / 100</h2></article>)}
        </div>
      </section>
      <SeoProviderSettings />
      <section className="seo-dashboard__section">
        <h2>Search providers</h2>
        <div className="admin-module-grid">
          {(["google", "bing", "baidu", "yandex"] as const).map((provider) => { const state = summary.providers[provider]; return <article className="admin-module-card" key={provider}><span>{provider}</span><h2>{state?.available ? "Connected" : "Unavailable"}</h2><p>{state?.fetchedAt ? `Last sync ${new Date(state.fetchedAt).toLocaleString()}` : "No metrics have been synced."}</p></article>; })}
        </div>
      </section>
    </div>
  );
}
