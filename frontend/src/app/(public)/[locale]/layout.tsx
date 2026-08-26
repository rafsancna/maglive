import { LOCALE_CODES } from "@maglive/contracts";
import type { ReactNode } from "react";
import { Footer } from "@/components/site/Footer";
import { Navbar } from "@/components/site/Navbar";
import { SkipLink } from "@/components/ui/SkipLink";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale } from "@/i18n/page-locale";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<import("next").Metadata> {
  const locale = await requireLocale(params);
  const dictionary = await getDictionary(locale);
  return { title: dictionary.brand.name, description: dictionary.home.intro, alternates: { canonical: new URL(`/${locale}`, process.env.SITE_URL ?? "http://localhost:3000").toString() } };
}

export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await requireLocale(params);
  const dictionary = await getDictionary(locale);

  return (
    <div className="site-shell">
      <SkipLink label={dictionary.accessibility.skipToContent} />
      <Navbar dictionary={dictionary} locale={locale} />
      <main id="main-content">{children}</main>
      <Footer dictionary={dictionary} locale={locale} />
    </div>
  );
}
