import {
  apiErrorSchema,
  authenticatedSessionDtoSchema,
  csrfDtoSchema,
  logoutDtoSchema,
  safeAdminDtoSchema,
  type FieldError,
  type AuthenticatedSessionDto,
  type SafeAdminDto
} from "@maglive/contracts";
import type { z } from "zod";

const apiBaseUrl = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api/v1"
).replace(/\/$/, "");

export const ADMIN_SESSION_EXPIRED_EVENT = "maglive:admin-session-expired";

export class AdminApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: readonly FieldError[] = []
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

let currentCsrfToken: string | null = null;

export function setCurrentCsrfToken(token: string): void {
  currentCsrfToken = token;
}

export function clearCurrentCsrfToken(): void {
  currentCsrfToken = null;
}

export function getCurrentCsrfToken(): string | null {
  return currentCsrfToken;
}

export function getAdminApiBaseUrl(): string {
  return apiBaseUrl;
}

export function notifySessionExpired(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ADMIN_SESSION_EXPIRED_EVENT));
  }
}

async function requestData<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
  init: RequestInit = {},
  notifyOnSessionFailure = true
): Promise<z.infer<TSchema>> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...init.headers
      }
    });
  } catch {
    throw new AdminApiError(0, "API_UNAVAILABLE", "The CMS API is unavailable.");
  }

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsedError = apiErrorSchema.safeParse(payload);
    const code = parsedError.success ? parsedError.data.error.code : "API_ERROR";
    const message = parsedError.success
      ? parsedError.data.error.message
      : "The CMS request failed.";
    if (notifyOnSessionFailure && (code === "AUTH_REQUIRED" || code === "SESSION_EXPIRED")) {
      clearCurrentCsrfToken();
      notifySessionExpired();
    }
    throw new AdminApiError(
      response.status,
      code,
      message,
      parsedError.success ? parsedError.data.error.details ?? [] : [],
    );
  }

  const rawData =
    typeof payload === "object" && payload !== null && "data" in payload
      ? payload.data
      : undefined;
  const parsed = schema.safeParse(rawData);
  if (!parsed.success) {
    throw new AdminApiError(502, "INVALID_API_RESPONSE", "The CMS response is invalid.");
  }
  return parsed.data;
}

export function requestAdminData<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
  init: RequestInit = {}
): Promise<z.infer<TSchema>> {
  return requestData(path, schema, init, true);
}

export async function requestAdminMutation<TSchema extends z.ZodType>(
  path: string,
  schema: TSchema,
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown
): Promise<z.infer<TSchema>> {
  const send = (csrfToken: string) => requestAdminData(path, schema, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  try {
    return await send(await getMutationCsrfToken());
  } catch (reason) {
    if (!(reason instanceof AdminApiError) || reason.code !== "CSRF_INVALID") throw reason;
    clearCurrentCsrfToken();
    return send(await fetchCsrfToken());
  }
}

export async function fetchCsrfToken(): Promise<string> {
  const result = await requestData("/admin/auth/csrf", csrfDtoSchema, {}, false);
  setCurrentCsrfToken(result.csrfToken);
  return result.csrfToken;
}

export async function loginAdministrator(
  email: string,
  password: string,
  csrfToken: string
): Promise<AuthenticatedSessionDto> {
  const result = await requestData(
    "/admin/auth/login",
    authenticatedSessionDtoSchema,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken
      },
      body: JSON.stringify({ email, password })
    },
    false
  );
  setCurrentCsrfToken(result.csrfToken);
  return result;
}

export function getCurrentAdministrator(): Promise<SafeAdminDto> {
  return requestData("/admin/auth/me", safeAdminDtoSchema, {}, false);
}

export async function logoutAdministrator(): Promise<void> {
  await requestAdminMutation("/admin/auth/logout", logoutDtoSchema, "POST");
  clearCurrentCsrfToken();
}

export async function getMutationCsrfToken(): Promise<string> {
  return getCurrentCsrfToken() ?? fetchCsrfToken();
}
