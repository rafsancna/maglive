import type { SeoScore } from "@maglive/contracts";

export function SeoScorePanel({ score, loading = false }: { score?: SeoScore | undefined; loading?: boolean | undefined }) {
  if (loading && score === undefined) {
    return <aside className="seo-score-panel" aria-live="polite">Calculating SEO score...</aside>;
  }
  if (score === undefined) return null;
  return (
    <aside className="seo-score-panel" aria-live="polite">
      <div className="seo-score-panel__header">
        <span>SEO score</span>
        <strong>{score.score} / 100</strong>
      </div>
      <ul>
        {score.issues.map((item) => (
          <li className={`seo-score-panel__issue seo-score-panel__issue--${item.status}`} key={item.key}>
            <span aria-hidden="true">{item.status === "passed" ? "✓" : item.status === "critical" ? "×" : "!"}</span>
            <span>{item.source === "yoast" ? "Yoast: " : ""}{item.message}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
}
