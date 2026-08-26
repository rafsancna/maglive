import type { RequestHandler } from "express";
import type { AppConfig } from "../config/env.js";
import { AppError } from "../errors/AppError.js";
import { UserModel, toSafeAdminDto } from "../models/User.js";
import {
  clearSessionCookie,
  destroySession,
  requestHasSessionCookie
} from "../auth/sessionLifecycle.js";

export function createRequireAdmin(config: AppConfig, now: () => number = Date.now): RequestHandler {
  return async (request, response, next) => {
    try {
      const sessionAdmin = request.session.admin;
      if (sessionAdmin === undefined) {
        const code = requestHasSessionCookie(request) ? "SESSION_EXPIRED" : "AUTH_REQUIRED";
        throw new AppError(401, code, "Administrator authentication is required.");
      }

      const nowMs = now();
      const idleExpired = nowMs - sessionAdmin.lastSeenAtMs > config.sessionIdleTimeoutMs;
      const absoluteExpired = nowMs >= sessionAdmin.absoluteExpiresAtMs;
      if (idleExpired || absoluteExpired) {
        await destroySession(request);
        clearSessionCookie(response, config);
        throw new AppError(401, "SESSION_EXPIRED", "The administrator session has expired.");
      }

      const user = await UserModel.findOne({ _id: sessionAdmin.userId, active: true });
      if (user === null) {
        await destroySession(request);
        clearSessionCookie(response, config);
        throw new AppError(401, "SESSION_EXPIRED", "The administrator session has expired.");
      }

      sessionAdmin.lastSeenAtMs = nowMs;
      request.session.cookie.expires = new Date(sessionAdmin.absoluteExpiresAtMs);
      request.session.cookie.originalMaxAge = Math.max(0, sessionAdmin.absoluteExpiresAtMs - nowMs);
      response.locals.admin = toSafeAdminDto(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}
