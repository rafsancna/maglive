import type { LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Container";
import { ArrowUpRightIcon } from "@/components/ui/icons";
import { LocaleLink } from "./LocaleLink";
import { BrandLogo } from "./BrandLogo";

export function Footer({
  dictionary,
  locale
}: {
  dictionary: Dictionary;
  locale: LocaleCode;
}) {
  const year = new Date().getUTCFullYear();
  const columns = [
    {
      title: dictionary.navigation.products,
      links: [
        { href: "/products", label: dictionary.navigation.products },
        { href: "/downloads", label: dictionary.navigation.downloads },
        { href: "/projects", label: dictionary.navigation.projects }
      ]
    },
    {
      title: dictionary.navigation.about,
      links: [
        { href: "/about", label: dictionary.navigation.about },
        { href: "/news", label: dictionary.navigation.news },
        { href: "/contact", label: dictionary.navigation.contact }
      ]
    }
  ] as const;

  return (
    <footer className="site-footer">
      <Container>
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <BrandLogo />
            <p className="site-footer__statement">{dictionary.footer.statement}</p>
            <LocaleLink className="site-footer__cta" href="/contact" locale={locale}>
              {dictionary.navigation.contact}
              <ArrowUpRightIcon />
            </LocaleLink>
          </div>
          <nav aria-label={dictionary.footer.navigation} className="site-footer__nav">
            {columns.map((column) => (
              <div className="site-footer__column" key={column.title}>
                <h2>{column.title}</h2>
                <ul>
                  {column.links.map((link) => (
                    <li key={`${column.title}-${link.href}`}>
                      <LocaleLink href={link.href} locale={locale}>
                        {link.label}
                      </LocaleLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="site-footer__bottom">
          <span className="site-footer__legal">
            © {year} {dictionary.brand.name}. {dictionary.footer.rights}
          </span>
          <span className="site-footer__status">{dictionary.footer.phaseStatus}</span>
        </div>
      </Container>
    </footer>
  );
}
