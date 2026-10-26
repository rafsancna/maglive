import type { ReactNode } from "react";

export function SectionHeader({
  eyebrow,
  title,
  intro,
  action,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-header">
      <div className="section-header__lead">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {intro === undefined && action === undefined ? null : (
        <div className="section-header__aside">
          {intro === undefined ? null : <p>{intro}</p>}
          {action}
        </div>
      )}
    </header>
  );
}
