import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { LocaleLink } from "@/components/site/LocaleLink";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale, type LocalizedPageProps } from "@/i18n/page-locale";

export default async function HomePage({ params }: LocalizedPageProps) {
  const locale = await requireLocale(params);
  const dictionary = await getDictionary(locale);

  return (
    <>
      <section className="hero">
        <div className="hero__glow" aria-hidden="true" />
        <Container className="hero__grid">
          <div className="hero__copy">
            <p className="eyebrow">{dictionary.home.eyebrow}</p>
            <Heading as="h1" size="display">
              {dictionary.home.title}
            </Heading>
            <p className="lede">{dictionary.home.intro}</p>
            <div className="button-row">
              <LocaleLink className="button button--primary" href="/products" locale={locale}>
                {dictionary.home.primaryAction}
              </LocaleLink>
              <LocaleLink className="button button--secondary" href="/contact" locale={locale}>
                {dictionary.home.secondaryAction}
              </LocaleLink>
            </div>
          </div>
          <div className="hero__visual" aria-hidden="true">
            <div className="energy-orbit energy-orbit--outer" />
            <div className="energy-orbit energy-orbit--inner" />
            <div className="energy-core">
              <span>630</span>
              <small>W / SYSTEM READY</small>
            </div>
            <div className="energy-label energy-label--one">SOLAR</div>
            <div className="energy-label energy-label--two">STORAGE</div>
            <div className="energy-label energy-label--three">CONTROL</div>
          </div>
        </Container>
      </section>

      <section className="principles">
        <Container>
          <div className="section-heading">
            <p className="eyebrow">MAGLIVE / 01—03</p>
            <Heading>{dictionary.home.principlesTitle}</Heading>
          </div>
          <div className="principle-grid">
            {dictionary.home.principles.map((principle) => (
              <article className="principle-card" key={principle.number}>
                <span>{principle.number}</span>
                <Heading as="h3" size="card">
                  {principle.title}
                </Heading>
                <p>{principle.text}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="closing-panel">
        <Container className="closing-panel__inner">
          <div>
            <p className="eyebrow">{dictionary.home.closingEyebrow}</p>
            <Heading>{dictionary.home.closingTitle}</Heading>
          </div>
          <div>
            <p>{dictionary.home.closingText}</p>
            <LocaleLink className="text-link" href="/about" locale={locale}>
              {dictionary.home.closingAction} <span aria-hidden="true">↗</span>
            </LocaleLink>
          </div>
        </Container>
      </section>
    </>
  );
}
