import { isLocaleCode, type LocaleCode } from "@maglive/contracts";
import { notFound } from "next/navigation";

export type LocalizedPageProps = {
  params: Promise<{ locale: string }>;
};

export async function requireLocale(
  params: LocalizedPageProps["params"]
): Promise<LocaleCode> {
  const { locale } = await params;
  if (!isLocaleCode(locale)) {
    notFound();
  }
  return locale;
}
