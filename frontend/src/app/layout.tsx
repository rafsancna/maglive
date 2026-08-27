import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE } from "@maglive/contracts";
import { LOCALE_REQUEST_HEADER } from "@/i18n/routing";
import { getAvailableLanguage } from "@/i18n/languages";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Maglive — Intelligent energy systems",
    template: "%s — Maglive"
  },
  description: "A multilingual corporate platform for technical energy products."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get(LOCALE_REQUEST_HEADER);
  const requestedLanguage = requestedLocale === null
    ? undefined
    : await getAvailableLanguage(requestedLocale);
  const metadata = requestedLanguage ?? await getAvailableLanguage(DEFAULT_LOCALE);

  return (
    <html
      data-scroll-behavior="smooth"
      dir={metadata?.direction ?? "ltr"}
      lang={metadata?.languageTag ?? DEFAULT_LOCALE}
    >
      <body>{children}</body>
    </html>
  );
}
