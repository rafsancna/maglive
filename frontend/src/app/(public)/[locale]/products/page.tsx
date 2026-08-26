import { ContentPage } from "@/components/site/ContentPage";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale, type LocalizedPageProps } from "@/i18n/page-locale";

export default async function ProductsPage({ params }: LocalizedPageProps) {
  const dictionary = await getDictionary(await requireLocale(params));
  return <ContentPage copy={dictionary.pages.products} />;
}
