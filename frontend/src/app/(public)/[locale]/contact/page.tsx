import { ContentPage } from "@/components/site/ContentPage";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale, type LocalizedPageProps } from "@/i18n/page-locale";

export default async function ContactPage({ params }: LocalizedPageProps) {
  const locale = await requireLocale(params);
  const dictionary = await getDictionary(locale);
  return <ContentPage copy={dictionary.pages.contact} ctaHref="/products" locale={locale} />;
}
