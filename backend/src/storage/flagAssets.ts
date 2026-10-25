import express, { type RequestHandler } from "express";
import { fileURLToPath } from "node:url";

/**
 * Country flags are shipped with the backend (`backend/assets/flags`) and served
 * read-only from `/media/flags/<country>.svg`.
 *
 * The folder sits next to `src`/`dist`, so the same relative path works in
 * development (`tsx src/server.ts`) and in production (`node dist/server.js`).
 */
export const flagAssetsDirectory = fileURLToPath(
  new URL("../../assets/flags", import.meta.url),
);

export function createFlagAssetsMiddleware(): RequestHandler {
  return express.static(flagAssetsDirectory, {
    acceptRanges: false,
    dotfiles: "deny",
    etag: true,
    fallthrough: false,
    immutable: true,
    index: false,
    maxAge: "1y",
    redirect: false,
    setHeaders(response) {
      response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader(
        "Cache-Control",
        "public, max-age=31536000, immutable",
      );
      // Flags are public artwork and are intentionally embeddable from any
      // website origin, including a CMS served from another domain.
      response.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      response.setHeader("Access-Control-Allow-Origin", "*");
    },
  });
}
