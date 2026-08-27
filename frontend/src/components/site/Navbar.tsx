import type { LanguageDto, LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Container";
import { LocaleLink } from "./LocaleLink";
import { LocaleSwitcher } from "./LocaleSwitcher";

const routes = [
  ["home", "/"],
  ["about", "/about"],
  ["products", "/products"],
  ["projects", "/projects"],
  ["news", "/news"],
  ["downloads", "/downloads"],
  ["contact", "/contact"]
] as const;

export function Navbar({
  dictionary,
  locale,
  languages
}: {
  dictionary: Dictionary;
  locale: LocaleCode;
  languages: readonly LanguageDto[];
}) {
  return (
    <header className="site-header">
      <Container className="site-header__inner">
        <LocaleLink aria-label={dictionary.brand.name} className="brand" href="/" locale={locale}>
          <span className="brand__mark" aria-hidden="true">
            M
          </span>
          <span>
            <strong>{dictionary.brand.name}</strong>
            <small>{dictionary.brand.descriptor}</small>
          </span>
        </LocaleLink>

        <nav aria-label={dictionary.accessibility.primaryNavigation} className="primary-nav">
          {routes.map(([key, href]) => (
            <LocaleLink href={href} key={key} locale={locale}>
              {dictionary.navigation[key]}
            </LocaleLink>
          ))}
        </nav>

        <LocaleSwitcher
          currentLocale={locale}
          label={dictionary.accessibility.languageSwitcher}
          languages={languages}
        />
      </Container>
    </header>
  );
}
