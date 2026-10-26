import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { DEFAULT_LOCALE } from "@maglive/contracts";
import { LOCALE_REQUEST_HEADER } from "@/i18n/routing";
import { getAvailableLanguage } from "@/i18n/languages";
import { getPublicSiteSettings } from "@/lib/public-api";
import "./globals.css";
import "./public.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "Maglive — Intelligent energy systems",
    template: "%s — Maglive"
  },
  description: "A multilingual corporate platform for technical energy products."
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let siteIcon:
    | { mimeType: string; width?: number; height?: number; version: number }
    | undefined;
  try {
    const settings = await getPublicSiteSettings();
    if (settings.icon !== undefined) {
      siteIcon = {
        mimeType: settings.icon.mimeType,
        ...(settings.icon.width === undefined
          ? {}
          : { width: settings.icon.width }),
        ...(settings.icon.height === undefined
          ? {}
          : { height: settings.icon.height }),
        version: settings.version,
      };
    }
  } catch {
    // Rendering remains available if site settings cannot be loaded.
  }
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
      <head>
        {siteIcon === undefined ? null : (
          <link
            href={`/api/site-icon?v=${siteIcon.version}`}
            rel="icon"
            sizes={
              siteIcon.width !== undefined && siteIcon.height !== undefined
                ? `${siteIcon.width}x${siteIcon.height}`
                : "any"
            }
            type={siteIcon.mimeType}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
