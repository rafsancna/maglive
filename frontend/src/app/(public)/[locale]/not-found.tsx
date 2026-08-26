import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocaleCode } from "@maglive/contracts";
import { Container } from "@/components/ui/Container";
import { Heading } from "@/components/ui/Heading";
import { getDictionary } from "@/i18n/get-dictionary";
import { LOCALE_REQUEST_HEADER } from "@/i18n/routing";

export default async function LocalizedNotFound() {
  const requestHeaders = await headers();
  const candidate = requestHeaders.get(LOCALE_REQUEST_HEADER);
  const locale = candidate !== null && isLocaleCode(candidate) ? candidate : DEFAULT_LOCALE;
  const dictionary = await getDictionary(locale);

  return (
    <div className="state-page">
      <Container>
        <p className="eyebrow">404</p>
        <Heading as="h1" size="display">
          {dictionary.states.notFoundTitle}
        </Heading>
        <p className="lede">{dictionary.states.notFoundText}</p>
      </Container>
    </div>
  );
}
