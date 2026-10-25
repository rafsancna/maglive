import { apiOrigin } from "@/lib/media-origin";

/**
 * Same-origin flag endpoint.
 *
 * The flag artwork is stored once, in the backend (`backend/assets/flags`) and
 * published there as `/media/flags/<country>.svg`. The website re-serves the
 * same files on its own origin, so the markup only ever contains a relative
 * `/flags/us.svg` link. That link keeps working on localhost, on a bare IP
 * address, behind a reverse proxy and on the production domain, without a
 * rebuild or a per-environment URL.
 */
const COUNTRY_PATTERN = /^[a-z]{2}$/;

function notFound(): Response {
  return new Response(null, {
    headers: { "Cache-Control": "public, max-age=300" },
    status: 404,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ country: string }> },
): Promise<Response> {
  const { country: rawCountry } = await params;
  const country = rawCountry.replace(/\.svg$/i, "").toLowerCase();
  if (!COUNTRY_PATTERN.test(country)) return notFound();

  try {
    const upstream = await fetch(`${apiOrigin()}/media/flags/${country}.svg`, {
      cache: "force-cache",
      headers: { Accept: "image/svg+xml" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!upstream.ok || upstream.body === null) return notFound();
    return new Response(upstream.body, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "image/svg+xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return notFound();
  }
}
