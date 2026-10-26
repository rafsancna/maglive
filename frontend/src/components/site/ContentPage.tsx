import type { LocaleCode } from "@maglive/contracts";
import type { PageCopy } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Container";
import { ArrowRightIcon, ArrowUpRightIcon } from "@/components/ui/icons";
import { LocaleLink } from "./LocaleLink";

/**
 * Editorial corporate page: a wide title plate, an asymmetric body column, an
 * optional numbered capability block, and a dark closing band. Every code-owned
 * page (About, Projects, Downloads, Contact) renders through this one template so
 * the corporate narrative stays visually consistent.
 */
export function ContentPage({
  copy,
  locale,
  ctaHref = "/contact",
}: {
  copy: PageCopy;
  locale: LocaleCode;
  ctaHref?: string;
}) {
  return (
    <div className="page">
      <section className="page-hero">
        <Container>
          <div className="page-hero__meta">
            <p className="eyebrow">{copy.eyebrow}</p>
            <span className="page-hero__rule" aria-hidden="true" />
          </div>
          <h1 className="page-hero__title">{copy.title}</h1>
          <div className="page-hero__body">
            <p className="page-hero__lede">{copy.intro}</p>
          </div>
        </Container>
      </section>

      <section className="page-body">
        <Container className="page-body__inner">
          <p className="page-body__label" aria-hidden="true">
            {copy.eyebrow}
          </p>
          <div className="page-body__copy">
            {copy.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {copy.note === undefined ? null : <p className="page-body__note">{copy.note}</p>}
          </div>
        </Container>
      </section>

      {copy.highlights === undefined ? null : (
        <section className="page-highlights">
          <Container>
            <header className="page-highlights__head">
              <p className="eyebrow">{copy.highlights.eyebrow}</p>
              <h2>{copy.highlights.title}</h2>
            </header>
            <ol className="page-highlights__grid">
              {copy.highlights.items.map((item) => (
                <li key={item.index}>
                  <span className="page-highlights__index">{item.index}</span>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      )}

      {copy.cta === undefined ? null : (
        <section className="cta-band">
          <Container className="cta-band__inner">
            <div className="cta-band__copy">
              <p className="eyebrow">{copy.cta.eyebrow}</p>
              <h2>{copy.cta.title}</h2>
              <p>{copy.cta.text}</p>
            </div>
            <LocaleLink className="cta cta--onDark" href={ctaHref} locale={locale}>
              {copy.cta.action}
              {ctaHref === "/contact" ? <ArrowRightIcon /> : <ArrowUpRightIcon />}
            </LocaleLink>
          </Container>
        </section>
      )}
    </div>
  );
}
