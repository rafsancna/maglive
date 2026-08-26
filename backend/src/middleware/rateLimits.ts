import { createHash } from "node:crypto";
import { normalizedEmailSchema } from "@maglive/contracts";
import type { Request, Response } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import type { AppConfig } from "../config/env.js";

function stableHash(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function clientIp(request: Request): string {
  return ipKeyGenerator(request.ip ?? "unknown");
}

function sendRateLimitError(response: Response) {
  response.status(429).json({
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests. Please try again later.",
      requestId: String(response.locals.requestId)
    }
  });
}

export function createLoginRateLimit(config: AppConfig) {
  return rateLimit({
    windowMs: 15 * 60 * 1_000,
    limit: config.loginRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    keyGenerator(request) {
      const parsedEmail = normalizedEmailSchema.safeParse(request.body?.email);
      const accountKey = parsedEmail.success ? stableHash(parsedEmail.data) : "invalid-account";
      return `${clientIp(request)}:${accountKey}`;
    },
    handler: (_request, response) => sendRateLimitError(response)
  });
}

export function createAdminMutationRateLimit(config: AppConfig) {
  return rateLimit({
    windowMs: 60 * 1_000,
    limit: config.adminMutationRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator(request) {
      const identity = request.session.admin?.userId ?? request.sessionID ?? clientIp(request);
      return stableHash(identity);
    },
    handler: (_request, response) => sendRateLimitError(response)
  });
}
