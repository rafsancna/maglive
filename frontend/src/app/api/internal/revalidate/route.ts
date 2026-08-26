import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { revalidationEventSchema } from "@maglive/contracts";

function expectedSignature(payload: string, timestamp: string): string {
  return createHmac("sha256", process.env.REVALIDATION_SECRET ?? "").update(`${timestamp}.${payload}`).digest("hex");
}

export async function POST(request: Request) {
  const timestamp = request.headers.get("X-Maglive-Timestamp") ?? "";
  const signature = request.headers.get("X-Maglive-Signature") ?? "";
  const payload = await request.text();
  const expected = expectedSignature(payload, timestamp);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  const valid = actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer) && Number.isFinite(Number(timestamp)) && Math.abs(Date.now() - Number(timestamp)) < 5 * 60 * 1_000;
  if (!valid) return NextResponse.json({ error: "Invalid revalidation signature." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let body: unknown;
  try { body = JSON.parse(payload) as unknown; } catch { return NextResponse.json({ error: "Invalid revalidation event." }, { status: 422, headers: { "Cache-Control": "no-store" } }); }
  const parsed = revalidationEventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid revalidation event." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  for (const tag of parsed.data.tags) revalidateTag(tag, "max");
  return NextResponse.json({ data: { revalidated: true } }, { headers: { "Cache-Control": "no-store" } });
}
