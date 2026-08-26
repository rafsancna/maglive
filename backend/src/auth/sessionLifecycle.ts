import type { Request, Response } from "express";
import type { AppConfig } from "../config/env.js";
import { SESSION_COOKIE_NAME } from "../config/session.js";

export function regenerateSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.regenerate((error) => (error === null || error === undefined ? resolve() : reject(error)));
  });
}

export function saveSession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.save((error) => (error === null || error === undefined ? resolve() : reject(error)));
  });
}

export function destroySession(request: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    request.session.destroy((error) => (error === null || error === undefined ? resolve() : reject(error)));
  });
}

export function clearSessionCookie(response: Response, config: AppConfig): void {
  response.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/"
  });
}

export function requestHasSessionCookie(request: Request): boolean {
  const cookieHeader = request.headers.cookie;
  if (cookieHeader === undefined) {
    return false;
  }
  return cookieHeader.split(";").some((cookie) => cookie.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
}
