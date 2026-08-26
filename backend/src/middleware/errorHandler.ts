import type { ErrorRequestHandler } from "express";
import { AppError } from "../errors/AppError.js";
import { logger } from "../config/logger.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (isRecord(error) && error.type === "entity.too.large") {
    return new AppError(413, "PAYLOAD_TOO_LARGE", "The request body exceeds the allowed size.");
  }

  if (error instanceof SyntaxError && isRecord(error) && "body" in error) {
    return new AppError(400, "MALFORMED_JSON", "The request body is not valid JSON.");
  }

  return new AppError(500, "INTERNAL_ERROR", "An unexpected server error occurred.");
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const normalized = normalizeError(error);
  const requestId = String(response.locals.requestId);

  if (normalized.status >= 500) {
    logger.error({ error, requestId }, "Request failed");
  }

  response.status(normalized.status).json({
    error: {
      code: normalized.code,
      message: normalized.message,
      ...(normalized.details === undefined ? {} : { details: normalized.details }),
      requestId
    }
  });
};
