/**
 * One place that answers "which origin serves this deployment?".
 *
 * Nothing in the codebase hard-codes a host: the API origin, the media origin
 * and the flag proxy are all derived here, so the same build runs on localhost,
 * a bare IP address, a staging domain or the production domain.
 *
 * Resolution order:
 * 1. `MEDIA_PUBLIC_ORIGIN` — explicit override (CDN or media sub-domain).
 * 2. The origin of `NEXT_PUBLIC_API_BASE_URL` — the API URL browsers use.
 * 3. The origin of `API_INTERNAL_URL` — good enough for server-side rendering.
 * 4. `http://localhost:5000` — local development.
 */

const LOCAL_API_ORIGIN = "http://localhost:5000";

function originOf(value: string | undefined): string | undefined {
  if (value === undefined || value.trim() === "") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
}

/** Origin of the API as reachable by browsers. */
export function apiOrigin(): string {
  return (
    originOf(process.env.NEXT_PUBLIC_API_BASE_URL) ??
    originOf(process.env.API_INTERNAL_URL) ??
    LOCAL_API_ORIGIN
  );
}

/** Origin that serves uploaded media and the bundled flag assets. */
export function mediaOrigin(): string {
  return originOf(process.env.MEDIA_PUBLIC_ORIGIN) ?? apiOrigin();
}

/**
 * Rewrites an absolute or root-relative media link so it always resolves
 * against the origin of the current deployment. The origin of the incoming link
 * is intentionally replaced, which is what keeps records seeded against
 * localhost, a bare IP address or an old staging domain working after a move.
 * Non-http(s) schemes are rejected.
 */
export function resolveMediaUrl(value: string): string | undefined {
  const origin = mediaOrigin();
  try {
    const url = new URL(value, `${origin}/`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return `${origin}${url.pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

/**
 * Path prefix under which uploaded media is served. `MEDIA_PUBLIC_ORIGIN` may
 * carry a path (`https://cdn.example.com/media`); otherwise the storage route
 * `/uploads` is used.
 */
function mediaPathPrefix(): string {
  try {
    const configured = new URL(process.env.MEDIA_PUBLIC_ORIGIN ?? "");
    if (configured.pathname !== "/") return configured.pathname.replace(/\/+$/, "");
  } catch {
    // Not configured or invalid: fall back to the storage route.
  }
  return "/uploads";
}

function isStoredMediaPath(pathname: string): boolean {
  const prefix = mediaPathPrefix();
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Rewrites the media links of an API payload in place so they follow the
 * deployment that renders them, without touching content links.
 *
 * - `url` and absolute `src` values that point at stored media (`/uploads/...`)
 *   are re-pointed at the origin of this deployment.
 * - Everything else — external content links, canonical URLs, root-relative
 *   site assets such as `/nav/hero.jpg` — is left untouched.
 *
 * Returns the media links that were rejected because they are not http(s) URLs.
 */
export function normalizeMediaUrlFields(value: unknown): readonly string[] {
  const rejected: string[] = [];
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (typeof candidate !== "object" || candidate === null) return;
    for (const [key, child] of Object.entries(candidate)) {
      if ((key === "url" || key === "src") && typeof child === "string") {
        const resolved = resolveMediaUrl(child);
        if (resolved === undefined) {
          if (key === "url") rejected.push(child);
          continue;
        }
        const pathname = storedMediaPathname(resolved);
        if (pathname !== undefined) {
          (candidate as Record<string, unknown>)[key] = resolved;
        }
      } else {
        visit(child);
      }
    }
  };
  visit(value);
  return rejected;
}

function storedMediaPathname(resolved: string): string | undefined {
  try {
    const url = new URL(resolved);
    return isStoredMediaPath(url.pathname) ? url.pathname : undefined;
  } catch {
    return undefined;
  }
}
