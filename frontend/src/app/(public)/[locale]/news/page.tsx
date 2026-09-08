import type { LocaleCode } from "@maglive/contracts";
import type { Metadata } from "next";
import { NewsExplorer } from "@/components/news/NewsExplorer";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireLocale, type LocalizedPageProps } from "@/i18n/page-locale";
import { listPublicNews } from "@/lib/public-api";
import { localizedPath } from "@/lib/seo";

export async function generateMetadata({ params }: LocalizedPageProps): Promise<Metadata> {
  const locale = await requireLocale(params) as LocaleCode;
  const dictionary = await getDictionary(locale);
  return { title: dictionary.pages.news.title, description: dictionary.pages.news.intro, alternates: { canonical: localizedPath(locale, "/news") }, openGraph: { type: "website", title: dictionary.pages.news.title, description: dictionary.pages.news.intro, url: localizedPath(locale, "/news") } };
}
export default async function NewsPage({ params }: LocalizedPageProps) {
  const locale = await requireLocale(params) as LocaleCode;
  const dictionary = await getDictionary(locale);
  let data: Awaited<ReturnType<typeof listPublicNews>> | null = null;
  try { data = await listPublicNews({ locale, page: 1, limit: 100 }); } catch { /* The route renders a recoverable service state below. */ }
  return <div className="news-page"><header className="news-page__header"><span className="eyebrow">{dictionary.pages.news.eyebrow}</span><h1>{dictionary.pages.news.title}</h1><p>{dictionary.pages.news.intro}</p></header>{data === null ? <div className="news-empty" role="alert"><strong>News is temporarily unavailable</strong><p>Please try again shortly.</p></div> : <NewsExplorer categories={data.categories} items={data.items} locale={locale} />}</div>;
}
