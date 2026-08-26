import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE, getLocaleMetadata, isLocaleCode } from "@maglive/contracts";
import { LOCALE_REQUEST_HEADER } from "@/i18n/routing";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Maglive — Intelligent energy systems",
    template: "%s — Maglive"
  },
  description: "A multilingual corporate platform for technical energy products."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get(LOCALE_REQUEST_HEADER);
  const locale = requestedLocale !== null && isLocaleCode(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE;
  const metadata = getLocaleMetadata(locale);

  return (
    <html dir={metadata.direction} lang={metadata.languageTag}>
      <body>{children}</body>
    </html>
  );
}
