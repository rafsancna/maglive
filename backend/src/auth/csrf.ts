import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Request } from "express";
import { AppError } from "../errors/AppError.js";

export const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_TOKEN_TTL_MS = 30 * 60 * 1_000;

function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("base64url");
}

export function issueCsrfToken(request: Request, nowMs = Date.now()): string {
  const token = randomBytes(32).toString("base64url");
  request.session.csrfTokenHash = hashToken(token);
  request.session.csrfIssuedAtMs = nowMs;
  return token;
}

export function assertValidCsrfToken(request: Request, nowMs = Date.now()): void {
  const suppliedToken = request.get(CSRF_HEADER_NAME);
  const storedHash = request.session.csrfTokenHash;
  const issuedAtMs = request.session.csrfIssuedAtMs;

  if (
    suppliedToken === undefined ||
    storedHash === undefined ||
    issuedAtMs === undefined ||
    nowMs - issuedAtMs > CSRF_TOKEN_TTL_MS
  ) {
    throw new AppError(403, "CSRF_INVALID", "The request could not be verified.");
  }

  const suppliedHash = hashToken(suppliedToken);
  const expected = Buffer.from(storedHash, "base64url");
  const actual = Buffer.from(suppliedHash, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new AppError(403, "CSRF_INVALID", "The request could not be verified.");
  }
}
