import { createHmac } from "node:crypto";
import { randomUUID } from "node:crypto";
import { revalidationEventSchema, type RevalidationEvent } from "@maglive/contracts";
import type { AppConfig } from "../config/env.js";

export function signRevalidationEvent(event: RevalidationEvent, secret: string, timestamp = Date.now()): { timestamp: string; signature: string; body: string } {
  const body = JSON.stringify(revalidationEventSchema.parse(event));
  const ts = String(timestamp);
  const signature = createHmac("sha256", secret).update(`${ts}.${body}`).digest("hex");
  return { timestamp: ts, signature, body };
}

export async function emitRevalidation(config: AppConfig, input: Omit<RevalidationEvent, "eventId" | "timestamp">): Promise<void> {
  const event = { ...input, eventId: randomUUID(), timestamp: Date.now() } satisfies RevalidationEvent;
  const signed = signRevalidationEvent(event, config.nextRevalidationSecret, event.timestamp);
  try {
    await fetch(config.nextRevalidationUrl, { method: "POST", headers: { "Content-Type": "application/json", "X-Maglive-Timestamp": signed.timestamp, "X-Maglive-Signature": signed.signature }, body: signed.body, signal: AbortSignal.timeout(2_000) });
  } catch {
    // Database mutations remain authoritative; the visibility gate prevents stale publication leaks.
  }
}

