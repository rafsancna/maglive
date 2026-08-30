import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { LocaleLink } from "@/components/site/LocaleLink";
import { HeroSlider } from "@/components/home/hero/HeroSlider";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale, type LocalizedPageProps } from "@/i18n/page-locale";

export default async function HomePage({ params }: LocalizedPageProps) {
  const locale = await requireLocale(params);
  const dictionary = await getDictionary(locale);

  return (
    <>
      <HeroSlider accessibilityTitle={dictionary.home.title} locale={locale} />

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
