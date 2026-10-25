import { flagPublicPath } from "@maglive/contracts";

type CountryFlagProps = {
  countryCode?: string | undefined;
  /** Wrapper class; the stylesheet crops the image to a circle. */
  className: string;
  /** Shown when the language has no stored flag. */
  fallback?: string | undefined;
  size?: number;
};

/**
 * Renders a stored country flag from the site's own origin (`/flags/us.svg`),
 * so flags look the same on every platform — Windows and most Linux desktops
 * have no glyphs for flag emoji — and keep working on any domain or IP address
 * the deployment runs on.
 */
export function CountryFlag({ countryCode, className, fallback, size = 40 }: CountryFlagProps) {
  if (countryCode === undefined || countryCode === "") {
    return (
      <span aria-hidden="true" className={`${className} ${className}--fallback`}>
        {fallback ?? "🌐"}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={className}>
      {/* A plain <img> is intentional: the flags are immutable local SVGs, so the
          image optimizer would only add a request hop. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" decoding="async" height={size} loading="lazy" src={flagPublicPath(countryCode)} width={size} />
    </span>
  );
}
