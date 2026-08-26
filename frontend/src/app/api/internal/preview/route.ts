import { draftMode } from "next/headers";
import { NextResponse } from "next/server";
import { exchangePreviewGrant } from "@/lib/preview-api";

export async function GET(request: Request) {
  const grant = new URL(request.url).searchParams.get("grant");
  if (!grant) return NextResponse.json({ error: "Preview grant is required." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const exchanged = await exchangePreviewGrant(grant);
    const mode = await draftMode();
    mode.enable();
    const response = NextResponse.redirect(new URL(`/${exchanged.locale}/products/${exchanged.slug}`, request.url), 303);
    response.cookies.set("maglive_preview", exchanged.accessCredential, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(exchanged.expiresAt) });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch {
    return NextResponse.json({ error: "Preview grant is invalid or expired." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}

