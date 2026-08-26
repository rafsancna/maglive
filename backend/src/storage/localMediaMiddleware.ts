import express, { type RequestHandler } from "express";
import type { LocalStorageProvider } from "./LocalStorageProvider.js";

export function createLocalMediaMiddleware(
  provider: LocalStorageProvider,
): RequestHandler {
  return express.static(provider.root, {
    acceptRanges: true,
    dotfiles: "deny",
    etag: true,
    fallthrough: false,
    immutable: true,
    maxAge: "1y",
    redirect: false,
    setHeaders(response) {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Cross-Origin-Resource-Policy", "same-site");
      response.setHeader(
        "Cache-Control",
        "public, max-age=31536000, immutable",
      );
    },
  });
}
