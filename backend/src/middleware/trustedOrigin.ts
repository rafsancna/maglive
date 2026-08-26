import type { RequestHandler } from "express";
import { AppError } from "../errors/AppError.js";

function getRefererOrigin(referer: string | undefined): string | undefined {
  if (referer === undefined) {
    return undefined;
  }
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

export function requireTrustedOrigin(frontendOrigin: string): RequestHandler {
  return (request, _response, next) => {
    const origin = request.get("origin") ?? getRefererOrigin(request.get("referer"));
    if (origin !== frontendOrigin) {
      next(new AppError(403, "CSRF_INVALID", "The request could not be verified."));
      return;
    }
    next();
  };
}
