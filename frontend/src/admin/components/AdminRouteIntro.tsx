import type { ReactNode } from "react";

export function AdminRouteIntro({
  eyebrow,
  title,
  text,
  children
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <section className="admin-route">
      <div className="admin-route__heading">
        <span className="admin-kicker">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </section>
  );
}
