import type { ReactNode } from "react";
import { Footer } from "@/components/site/Footer";
import { Navbar } from "@/components/site/Navbar";
import { SkipLink } from "@/components/ui/SkipLink";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale } from "@/i18n/page-locale";
import { getAvailableLanguages } from "@/i18n/languages";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<import("next").Metadata> {
  const locale = await requireLocale(params);
  const dictionary = await getDictionary(locale);
  return { title: dictionary.brand.name, description: dictionary.home.intro, alternates: { canonical: new URL(`/${locale}`, process.env.SITE_URL ?? "http://localhost:3000").toString() } };
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const locale = await requireLocale(params);
  const [dictionary, languages] = await Promise.all([
    getDictionary(locale),
    getAvailableLanguages(),
  ]);

  return (
    <div className="site-shell">
      <SkipLink label={dictionary.accessibility.skipToContent} />
      <Navbar dictionary={dictionary} locale={locale} languages={languages} />
      <main id="main-content">{children}</main>
      <Footer dictionary={dictionary} locale={locale} />
    </div>
  );
}
