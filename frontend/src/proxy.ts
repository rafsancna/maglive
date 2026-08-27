import {
  LOCALE_CODES,
  getLocaleMetadata,
  isLocaleCode,
  languageListDtoSchema,
  type LanguageDto,
} from "@maglive/contracts";
import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_REQUEST_HEADER,
  detectLocale,
  getPathLocale,
  isExcludedFromLocaleRouting,
  looksLikeUnsupportedLocale
} from "./i18n/routing";

const languageApiBase = (
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:5000/api/v1"
).replace(/\/$/, "");
const builtInLanguages: readonly LanguageDto[] = LOCALE_CODES.map((code) => {
  const metadata = getLocaleMetadata(code);
  return {
    code,
    languageTag: metadata.languageTag,
    acceptLanguageAliases: [...metadata.acceptLanguageAliases],
    direction: metadata.direction,
    fallback: metadata.fallback,
    label: metadata.label,
    nativeLabel: metadata.nativeLabel,
    builtIn: true,
  };
});
let languageCache: { expiresAt: number; languages: readonly LanguageDto[] } | undefined;

async function routingLanguages(): Promise<readonly LanguageDto[]> {
  if (languageCache !== undefined && languageCache.expiresAt > Date.now()) {
    return languageCache.languages;
  }
  try {
    const response = await fetch(`${languageApiBase}/public/languages`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1_000),
    });
    const payload: unknown = await response.json();
    const raw = typeof payload === "object" && payload !== null && "data" in payload
      ? payload.data
      : undefined;
    const languages = languageListDtoSchema.parse(raw).languages;
    languageCache = { expiresAt: Date.now() + 60_000, languages };
    return languages;
  } catch {
    return builtInLanguages;
  }
}

function continueWithLocale(request: NextRequest, locale: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_REQUEST_HEADER, locale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  if (isExcludedFromLocaleRouting(pathname)) {
    return NextResponse.next();
  }

  const pathLocale = getPathLocale(pathname);
  if (pathLocale !== undefined && isLocaleCode(pathLocale)) {
    return continueWithLocale(request, pathLocale);
  }

  if (looksLikeUnsupportedLocale(pathname)) {
    return continueWithLocale(request, "en");
  }

  const locale = detectLocale(
    request.cookies.get(LOCALE_COOKIE_NAME)?.value,
    request.headers.get("accept-language"),
    await routingLanguages(),
  );
  const destination = request.nextUrl.clone();
  destination.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
