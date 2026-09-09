import type { LocaleCode } from "@maglive/contracts";
import { LocaleLink } from "./LocaleLink";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`brand__logo ${className}`.trim()}>
      <span>MA</span>
      <span className="brand__logo-g">G</span>
      <span>LIVE</span>
    </span>
  );
}

export function BrandLink({
  href = "/",
  locale,
  onClick,
  label,
}: {
  href?: string;
  locale: LocaleCode;
  onClick?: () => void;
  label: string;
}) {
  return (
    <LocaleLink aria-label={label} className="brand" href={href} locale={locale} {...(onClick === undefined ? {} : { onClick })}>
      <BrandLogo />
    </LocaleLink>
  );
}
