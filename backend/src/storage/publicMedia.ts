import { AsyncLocalStorage } from "node:async_hooks";
import type { Request, RequestHandler } from "express";

/**
 * Media links must stay valid on whichever host, IP address or domain the
 * deployment happens to use. Instead of baking one origin into every stored
 * record, the backend resolves the public origin of the *current request* and
 * builds absolute media URLs from it.
 *
 * `PUBLIC_MEDIA_BASE_URL` still wins when it holds an absolute URL, so an
 * existing deployment (or a CDN in front of the uploads folder) keeps behaving
 * exactly as before. Point it at a root-relative path such as `/uploads` — or
 * leave it empty — and every media link follows the request origin instead.
 */

export const MEDIA_ROUTE_PREFIX = "/uploads";
export const FLAGS_ROUTE_PREFIX = "/media/flags";

type RequestOrigins = Readonly<{
  /** Public origin of the API as seen by the client that made the request. */
  origin?: string;
}>;

const requestOrigins = new AsyncLocalStorage<RequestOrigins>();

export function runWithRequestOrigin<T>(
  origin: string | undefined,
  callback: () => T,
): T {
  return origin === undefined
    ? callback()
    : requestOrigins.run({ origin }, callback);
}

export function currentRequestOrigin(): string | undefined {
  return requestOrigins.getStore()?.origin;
}

export function isPublicOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    );
  } catch {
    return false;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/**
 * Base URL of a stored media object, without a trailing slash and without the
 * object key.
 *
 * - Absolute (`https://cdn.example.com/uploads`) → used verbatim.
 * - Root-relative (`/uploads`) or empty → joined with the current request
 *   origin, which keeps working behind any domain, IP address or reverse proxy.
 */
export function resolveMediaBaseUrl(configuredBaseUrl: string): string {
  const configured = trimTrailingSlash(configuredBaseUrl.trim());
  if (configured !== "" && !configured.startsWith("/")) {
    return configured;
  }
  const path = configured === "" ? MEDIA_ROUTE_PREFIX : configured;
  return `${currentRequestOrigin() ?? ""}${path}`;
}

/** Same-origin base URL of the bundled flag assets for the current request. */
export function resolveFlagBaseUrl(): string {
  return `${currentRequestOrigin() ?? ""}${FLAGS_ROUTE_PREFIX}`;
}

function advertisedOrigin(request: Request): string | undefined {
  // Sent by the website when it renders on the server: those requests come from
  // the internal network and would otherwise advertise an origin that browsers
  // cannot reach. It only affects the URLs inside that requester's own response.
  const advertised = request.get("x-public-origin");
  if (advertised !== undefined && advertised !== "" && isPublicOrigin(advertised)) {
    return new URL(advertised).origin;
  }
  return undefined;
}

function originFromHost(request: Request): string | undefined {
  const host = request.get("host");
  if (host === undefined || host === "") return undefined;
  // `request.protocol` honours the configured `trust proxy` setting.
  return `${request.protocol}://${host}`;
}

export function createPublicOriginsMiddleware(): RequestHandler {
  return (request, _response, next) => {
    runWithRequestOrigin(
      advertisedOrigin(request) ?? originFromHost(request),
      next,
    );
  };
}
