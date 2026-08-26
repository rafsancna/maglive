import { loginRequestSchema, type SafeAdminDto } from "@maglive/contracts";
import { Router } from "express";
import type { AppConfig } from "../../config/env.js";
import { assertValidCsrfToken, issueCsrfToken } from "../../auth/csrf.js";
import {
  clearSessionCookie,
  destroySession,
  regenerateSession,
  saveSession
} from "../../auth/sessionLifecycle.js";
import { AppError } from "../../errors/AppError.js";
import { createRequireAdmin } from "../../middleware/requireAdmin.js";
import { createAdminMutationRateLimit, createLoginRateLimit } from "../../middleware/rateLimits.js";
import { requireTrustedOrigin } from "../../middleware/trustedOrigin.js";
import { toSafeAdminDto } from "../../models/User.js";
import { authenticateAdministrator } from "../../services/authService.js";

export type AuthRouterDependencies = Readonly<{
  config: AppConfig;
  now?: () => number;
}>;

function toFieldDetails(error: ReturnType<typeof loginRequestSchema.safeParse>) {
  if (error.success) {
    return undefined;
  }
  return error.error.issues.map((issue) => ({
    path: issue.path.join(".") || "body",
    code: "INVALID_VALUE",
    message: issue.message
  }));
}

export function createAuthRouter({ config, now = Date.now }: AuthRouterDependencies): Router {
  const router = Router();
  const trustedOrigin = requireTrustedOrigin(config.frontendOrigin);
  const requireAdmin = createRequireAdmin(config, now);
  const loginRateLimit = createLoginRateLimit(config);
  const mutationRateLimit = createAdminMutationRateLimit(config);

  router.get("/csrf", (request, response, next) => {
    try {
      const token = issueCsrfToken(request, now());
      if (request.session.admin === undefined) {
        request.session.cookie.maxAge = config.sessionIdleTimeoutMs;
      }
      response.json({ data: { csrfToken: token } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", loginRateLimit, trustedOrigin, async (request, response, next) => {
    try {
      assertValidCsrfToken(request, now());
      const parsed = loginRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new AppError(400, "VALIDATION_FAILED", "The login request is invalid.", toFieldDetails(parsed));
      }

      const user = await authenticateAdministrator(parsed.data);
      await regenerateSession(request);
      const startedAtMs = now();
      const absoluteExpiresAtMs = startedAtMs + config.sessionAbsoluteTimeoutMs;
      request.session.admin = {
        userId: user._id.toString(),
        startedAtMs,
        lastSeenAtMs: startedAtMs,
        absoluteExpiresAtMs
      };
      request.session.cookie.expires = new Date(absoluteExpiresAtMs);
      request.session.cookie.originalMaxAge = config.sessionAbsoluteTimeoutMs;
      const csrfToken = issueCsrfToken(request, startedAtMs);
      await saveSession(request);

      response.json({ data: { admin: toSafeAdminDto(user), csrfToken } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/me", requireAdmin, (_request, response) => {
    response.json({ data: response.locals.admin as SafeAdminDto });
  });

  router.post(
    "/logout",
    trustedOrigin,
    requireAdmin,
    mutationRateLimit,
    async (request, response, next) => {
      try {
        assertValidCsrfToken(request, now());
        await destroySession(request);
        clearSessionCookie(response, config);
        response.json({ data: { loggedOut: true } });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
