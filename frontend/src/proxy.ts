import { isLocaleCode } from "@maglive/contracts";
import { NextResponse, type NextRequest } from "next/server";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_REQUEST_HEADER,
  detectLocale,
  getPathLocale,
  isExcludedFromLocaleRouting,
  looksLikeUnsupportedLocale
} from "./i18n/routing";

function continueWithLocale(request: NextRequest, locale: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_REQUEST_HEADER, locale);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export function proxy(request: NextRequest): NextResponse {
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
    request.headers.get("accept-language")
  );
  const destination = request.nextUrl.clone();
  destination.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(destination);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
