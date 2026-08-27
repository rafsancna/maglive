import type { LocaleCode } from "@maglive/contracts";
import { notFound } from "next/navigation";
import { getAvailableLanguage } from "./languages";

export type LocalizedPageProps = {
  params: Promise<{ locale: string }>;
};

export async function requireLocale(
  params: LocalizedPageProps["params"]
): Promise<LocaleCode> {
  const { locale } = await params;
  if (await getAvailableLanguage(locale) === undefined) {
    notFound();
  }
  return locale;
}
