import pino from "pino";

export const logger = pino({
  level: process.env.NODE_ENV === "test" ? "silent" : process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "password",
      "csrfToken",
      "token",
      "SESSION_SECRET",
      "PREVIEW_SIGNING_SECRET",
      "PREVIEW_EXCHANGE_SECRET",
      "NEXT_REVALIDATION_SECRET"
    ],
    censor: "[REDACTED]"
  },
  base: null
});
