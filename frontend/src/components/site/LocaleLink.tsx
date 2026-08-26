import type { LocaleCode } from "@maglive/contracts";
import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { localizePath } from "@/i18n/routing";

type LocaleLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<LinkProps, "href"> & {
    children: ReactNode;
    href: string;
    locale: LocaleCode;
  };

export function LocaleLink({ children, href, locale, ...props }: LocaleLinkProps) {
  return (
    <Link href={localizePath(locale, href)} {...props}>
      {children}
    </Link>
  );
}
