import type { LocaleCode } from "@maglive/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NewsDetail } from "@/components/news/NewsDetail";
import { getAvailableLanguages } from "@/i18n/languages";
import { requireLocale } from "@/i18n/page-locale";
import { getPublicNews, PublicApiError } from "@/lib/public-api";
import { newsMetadata } from "@/lib/seo";
import { NewsStructuredData } from "@/lib/structured-data";

type NewsPageProps = { params: Promise<{ locale: string; slug: string }> };
export async function generateMetadata({ params }: NewsPageProps): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = await requireLocale(Promise.resolve({ locale: rawLocale })) as LocaleCode;
  try { return newsMetadata(await getPublicNews(slug, locale), locale, await getAvailableLanguages()); } catch { return { title: "News" }; }
}
export default async function SingleNewsPage({ params }: NewsPageProps) {
  const { locale: rawLocale, slug } = await params;
  const locale = await requireLocale(Promise.resolve({ locale: rawLocale })) as LocaleCode;
  let news: Awaited<ReturnType<typeof getPublicNews>> | null = null;
  let failure: unknown;
  try { news = await getPublicNews(slug, locale); } catch (error) { failure = error; }
  if (failure instanceof PublicApiError && failure.status === 404) notFound();
  if (news === null) return <main className="news-detail"><div className="news-empty" role="alert"><strong>News temporarily unavailable</strong><p>Please retry shortly.</p></div></main>;
  return <><NewsDetail locale={locale} news={news} /><NewsStructuredData locale={locale} news={news} /></>;
}
