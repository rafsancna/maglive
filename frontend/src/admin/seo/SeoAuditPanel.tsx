import type { SeoAudit } from "@maglive/contracts";

export function SeoAuditPanel({ audit }: { audit: SeoAudit | undefined }) {
  if (audit === undefined) return null;
  return (
    <aside className="seo-score-panel seo-audit-panel" aria-live="polite">
      <div className="seo-score-panel__header">
        <span>Rendered page audit</span>
        <strong>{audit.score} / 100</strong>
      </div>
      <p className="product-editor__muted">HTTP {audit.httpStatus} · {new Date(audit.createdAt).toLocaleString()}</p>
      {audit.error ? <p className="admin-alert" role="alert">{audit.error}</p> : null}
      <ul>
        {audit.checks.map((item) => (
          <li className={`seo-score-panel__issue seo-score-panel__issue--${item.status}`} key={item.key}>
            <span aria-hidden="true">{item.status === "passed" ? "✓" : item.status === "critical" ? "×" : "!"}</span>
            <span>{item.message}</span>
          </li>
        ))}
      </ul>
      {audit.brokenLinks.length > 0 ? <p className="product-editor__muted">Broken links: {audit.brokenLinks.join(", ")}</p> : null}
    </aside>
  );
}
