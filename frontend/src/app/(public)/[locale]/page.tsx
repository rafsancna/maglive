import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { ArrowRightIcon, ArrowUpRightIcon } from "@/components/ui/icons";
import { LocaleLink } from "@/components/site/LocaleLink";
import { SectionHeader } from "@/components/site/SectionHeader";
import { HeroSlider } from "@/components/home/hero/HeroSlider";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale, type LocalizedPageProps } from "@/i18n/page-locale";
import { getNavigationData } from "@/lib/navigation.service";
import { localized } from "@/types/navigation";

export default async function HomePage({ params }: LocalizedPageProps) {
  const locale = await requireLocale(params);
  const [dictionary, navigationData] = await Promise.all([getDictionary(locale), getNavigationData(locale)]);
  const copy = dictionary.home;

  const productCategories = navigationData.productCategories.slice(0, 4);
  const featuredProduct = navigationData.featuredProducts[0];
  const featuredSolution = navigationData.featuredSolution;
  const newsItems = navigationData.news.slice(0, 3);

  return (
    <>
      <HeroSlider
        controls={copy.hero.controls}
        locale={locale}
        slides={copy.hero.slides}
      />

      <section className="statement">
        <Container className="statement__inner">
          <div className="statement__grid">
            <div className="statement__lead">
              <p className="eyebrow">{copy.eyebrow}</p>
              <h2>{copy.title}</h2>
            </div>
            <div className="statement__aside">
              <p>{copy.intro}</p>
              <div className="statement__actions">
                <LocaleLink className="cta cta--primary" href="/products" locale={locale}>
                  {copy.primaryAction}
                  <ArrowRightIcon />
                </LocaleLink>
                <LocaleLink className="link-arrow" href="/contact" locale={locale}>
                  {copy.secondaryAction}
                  <ArrowUpRightIcon />
                </LocaleLink>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {productCategories.length === 0 ? null : (
        <section className="systems" id="systems">
          <Container>
            <SectionHeader
              action={
                <LocaleLink className="link-arrow" href="/products" locale={locale}>
                  {copy.systems.action}
                  <ArrowUpRightIcon />
                </LocaleLink>
              }
              eyebrow={copy.systems.eyebrow}
              intro={copy.systems.intro}
              title={copy.systems.title}
            />
            <ol className="systems__grid">
              {productCategories.map((category, index) => (
                <li className="system-card" key={localized(category.label, locale)}>
                  <LocaleLink className="system-card__link" href={category.href} locale={locale}>
                    <span className="system-card__index">{String(index + 1).padStart(2, "0")}</span>
                    <span className="system-card__title">{localized(category.label, locale)}</span>
                    <span className="system-card__text">{localized(category.description, locale)}</span>
                    <span className="system-card__action" aria-hidden="true">
                      <ArrowUpRightIcon />
                    </span>
                  </LocaleLink>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      )}

      <section className="feature">
        <Container className="feature__inner">
          <div className="feature__media">
            <Image
              alt={localized(featuredSolution.image.alt, locale)}
              fill
              sizes="(max-width: 62rem) 100vw, 58vw"
              src={featuredSolution.image.src}
            />
            <span className="feature__tag">{localized(featuredSolution.kicker, locale)}</span>
          </div>
          <div className="feature__copy">
            <p className="eyebrow">{copy.solutions.eyebrow}</p>
            <h2>{copy.solutions.title}</h2>
            <p>{localized(featuredSolution.description, locale)}</p>
            <div className="feature__meta">
              <span>{localized(featuredSolution.label, locale)}</span>
              <LocaleLink className="cta cta--onDark" href={featuredSolution.href} locale={locale}>
                {copy.solutions.action}
                <ArrowRightIcon />
              </LocaleLink>
            </div>
          </div>
        </Container>
      </section>

      {featuredProduct === undefined ? null : (
        <section className="spotlight">
          <Container className="spotlight__inner">
            <div className="spotlight__copy">
              <p className="eyebrow">{copy.featuredProduct.eyebrow}</p>
              <h2>{localized(featuredProduct.label, locale)}</h2>
              <p>{localized(featuredProduct.description, locale)}</p>
              <LocaleLink className="cta cta--primary" href={featuredProduct.href} locale={locale}>
                {copy.featuredProduct.action}
                <ArrowRightIcon />
              </LocaleLink>
            </div>
            <div className="spotlight__media">
              <Image
                alt={localized(featuredProduct.image.alt, locale)}
                fill
                sizes="(max-width: 62rem) 100vw, 52vw"
                src={featuredProduct.image.src}
              />
              <span className="spotlight__tag">{localized(featuredProduct.tag, locale)}</span>
            </div>
          </Container>
        </section>
      )}

      <section className="principles">
        <Container>
          <SectionHeader eyebrow={copy.principlesEyebrow} title={copy.principlesTitle} />
          <ol className="principles__grid">
            {copy.principles.map((principle) => (
              <li key={principle.number}>
                <span className="principles__index">{principle.number}</span>
                <h3>{principle.title}</h3>
                <p>{principle.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {newsItems.length === 0 ? null : (
        <section className="newsroom-teaser">
          <Container>
            <SectionHeader
              action={
                <LocaleLink className="link-arrow" href="/news" locale={locale}>
                  {copy.news.action}
                  <ArrowUpRightIcon />
                </LocaleLink>
              }
              eyebrow={copy.news.eyebrow}
              intro={copy.news.intro}
              title={copy.news.title}
            />
            <ul className="newsroom-teaser__grid">
              {newsItems.map((item) => (
                <li key={localized(item.label, locale)}>
                  <LocaleLink className="teaser-card" href={item.href} locale={locale}>
                    <span className="teaser-card__media">
                      <Image alt={localized(item.image.alt, locale)} fill sizes="(max-width: 48rem) 100vw, 32vw" src={item.image.src} />
                    </span>
                    <span className="teaser-card__meta">
                      {localized(item.category, locale)}
                      <i aria-hidden="true" />
                      {localized(item.date, locale)}
                    </span>
                    <span className="teaser-card__title">{localized(item.label, locale)}</span>
                    <span className="teaser-card__more">
                      {dictionary.menu.readMore}
                      <ArrowUpRightIcon />
                    </span>
                  </LocaleLink>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <section className="cta-band">
        <Container className="cta-band__inner">
          <div className="cta-band__copy">
            <p className="eyebrow">{copy.closing.eyebrow}</p>
            <h2>{copy.closing.title}</h2>
            <p>{copy.closing.text}</p>
          </div>
          <LocaleLink className="cta cta--onDark" href="/contact" locale={locale}>
            {copy.closing.action}
            <ArrowRightIcon />
          </LocaleLink>
        </Container>
      </section>
    </>
  );
}
