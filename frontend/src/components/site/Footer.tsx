import type { LocaleCode } from "@maglive/contracts";
import type { Dictionary } from "@/i18n/dictionary";
import { Container } from "@/components/ui/Container";
import { LocaleLink } from "./LocaleLink";
import { BrandLogo } from "./BrandLogo";

export function Footer({
  dictionary,
  locale
}: {
  dictionary: Dictionary;
  locale: LocaleCode;
}) {
  return (
    <footer className="site-footer">
      <Container className="site-footer__grid">
        <div>
          <div className="site-footer__brand">
            <BrandLogo />
          </div>
          <p>{dictionary.footer.statement}</p>
        </div>
        <div className="site-footer__meta">
          <span>{dictionary.footer.phaseStatus}</span>
          <LocaleLink href="/contact" locale={locale}>
            {dictionary.navigation.contact}
          </LocaleLink>
          <span>
            © {new Date().getUTCFullYear()} {dictionary.brand.name}. {dictionary.footer.rights}
          </span>
        </div>
      </Container>
    </footer>
  );
}
