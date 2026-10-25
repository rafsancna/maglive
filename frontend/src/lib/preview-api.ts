import { previewExchangeResponseSchema, previewProductDtoSchema, type PreviewExchangeResponse } from "@maglive/contracts";
import type { z as Zod } from "zod";
import { apiOrigin, normalizeMediaUrlFields } from "@/lib/media-origin";

const apiBase = (process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1").replace(/\/$/, "");

// Server-side calls come from the internal network, so they tell the API which
// origin browsers use. Media links are then re-pointed at the origin of this
// deployment, exactly like the public catalog does.
const publicOriginHeader = { "X-Public-Origin": apiOrigin() };

export async function exchangePreviewGrant(grant: string): Promise<PreviewExchangeResponse> {
  const response = await fetch(`${apiBase}/preview/exchange`, {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Preview-Exchange-Secret": process.env.PREVIEW_EXCHANGE_SECRET ?? "", ...publicOriginHeader },
    body: JSON.stringify({ grant }),
  });
  const payload: unknown = await response.json().catch(() => undefined);
  const data = typeof payload === "object" && payload !== null && "data" in payload ? payload.data : undefined;
  if (!response.ok) throw new Error("Preview exchange failed");
  const parsed = previewExchangeResponseSchema.safeParse(data);
  if (!parsed.success) throw new Error("Preview exchange response is invalid");
  return parsed.data;
}

export async function getPreviewProduct(accessCredential: string): Promise<Zod.infer<typeof previewProductDtoSchema>> {
  const response = await fetch(`${apiBase}/preview/products`, { cache: "no-store", headers: { Accept: "application/json", Authorization: `Preview ${accessCredential}`, ...publicOriginHeader } });
  const payload: unknown = await response.json().catch(() => undefined);
  const data = typeof payload === "object" && payload !== null && "data" in payload ? payload.data : undefined;
  if (!response.ok) throw new Error("Preview is no longer available");
  const parsed = previewProductDtoSchema.safeParse(data);
  if (!parsed.success) throw new Error("Preview response is invalid");
  if (normalizeMediaUrlFields(parsed.data).length > 0) throw new Error("Preview response contains an unsafe media URL");
  return parsed.data;
}
