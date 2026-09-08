import { getPublicSiteSettings } from "@/lib/public-api";

export async function GET(): Promise<Response> {
  try {
    const { icon } = await getPublicSiteSettings();
    if (icon === undefined) {
      return new Response(null, { status: 404 });
    }
    const upstream = await fetch(icon.url, {
      cache: "no-store",
      headers: { Accept: "image/*" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!upstream.ok || upstream.body === null) {
      return new Response(null, { status: 502 });
    }
    return new Response(upstream.body, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": icon.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
