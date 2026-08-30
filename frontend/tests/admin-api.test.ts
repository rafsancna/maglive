import { logoutDtoSchema, safeAdminDtoSchema } from "@maglive/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  clearCurrentCsrfToken,
  fetchCsrfToken,
  getCurrentCsrfToken,
  loginAdministrator,
  logoutAdministrator,
  requestAdminData,
  requestAdminMutation,
  setCurrentCsrfToken,
} from "@/admin/auth/api";

const admin = {
  id: "507f1f77bcf86cd799439011",
  email: "admin@example.com",
  role: "admin" as const
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

beforeEach(() => {
  clearCurrentCsrfToken();
  vi.unstubAllGlobals();
});

describe("administrator API client", () => {
  it("uses credentials, replaces CSRF after rotation, and signals protected-session failure", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ data: { csrfToken: "pre-auth-csrf-token-value-00000001" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: { admin, csrfToken: "authenticated-csrf-token-value-000001" }
        })
      )
      .mockResolvedValueOnce(jsonResponse({ data: { loggedOut: true } }))
      .mockResolvedValueOnce(
        jsonResponse({
          error: {
            code: "SESSION_EXPIRED",
            message: "Session expired",
            requestId: "8a595af7-52c0-4fd0-8028-5f5a4a309509"
          }
        }, 401)
      );
    vi.stubGlobal("fetch", fetchMock);

    const preAuthToken = await fetchCsrfToken();
    await loginAdministrator("admin@example.com", "password", preAuthToken);
    expect(getCurrentCsrfToken()).toBe("authenticated-csrf-token-value-000001");
    await logoutAdministrator();

    const loginInit = fetchMock.mock.calls[1]?.[1];
    expect(loginInit?.credentials).toBe("include");
    expect(loginInit?.cache).toBe("no-store");
    expect(new Headers(loginInit?.headers).get("X-CSRF-Token")).toBe(preAuthToken);
    const logoutInit = fetchMock.mock.calls[2]?.[1];
    expect(new Headers(logoutInit?.headers).get("X-CSRF-Token")).toBe(
      "authenticated-csrf-token-value-000001"
    );

    let expiryEvents = 0;
    const countExpiry = () => {
      expiryEvents += 1;
    };
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, countExpiry);
    await expect(
      requestAdminData("/admin/auth/me", safeAdminDtoSchema)
    ).rejects.toMatchObject({ code: "SESSION_EXPIRED" });
    window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, countExpiry);
    expect(expiryEvents).toBe(1);
  });

  it("refreshes a stale CSRF token and retries a mutation once", async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({
        error: {
          code: "CSRF_INVALID",
          message: "The request could not be verified.",
          requestId: "8a595af7-52c0-4fd0-8028-5f5a4a309509",
        },
      }, 403))
      .mockResolvedValueOnce(jsonResponse({ data: { csrfToken: "refreshed-csrf-token-value-00000001" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { loggedOut: true } }));
    vi.stubGlobal("fetch", fetchMock);
    setCurrentCsrfToken("stale-csrf-token-value-00000000001");

    await expect(
      requestAdminMutation("/admin/example", logoutDtoSchema, "POST", { value: true }),
    ).resolves.toEqual({ loggedOut: true });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("X-CSRF-Token")).toBe(
      "stale-csrf-token-value-00000000001",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/admin/auth/csrf");
    expect(new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get("X-CSRF-Token")).toBe(
      "refreshed-csrf-token-value-00000001",
    );
  });
});
