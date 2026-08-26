import { draftMode } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const mode = await draftMode();
  mode.disable();
  const response = NextResponse.redirect(new URL("/admin/products", request.url), 303);
  response.cookies.set("maglive_preview", "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(0) });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

