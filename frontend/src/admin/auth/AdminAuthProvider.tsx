"use client";

import type { SafeAdminDto } from "@maglive/contracts";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react";
import {
  ADMIN_SESSION_EXPIRED_EVENT,
  AdminApiError,
  clearCurrentCsrfToken,
  fetchCsrfToken,
  getCurrentAdministrator,
  logoutAdministrator
} from "./api";
import { buildAdminLoginPath } from "./return-path";

type AdminAuthContextValue = Readonly<{
  admin: SafeAdminDto;
  logout: () => Promise<void>;
  loggingOut: boolean;
}>;

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function useAdminAuth(): AdminAuthContextValue {
  const value = useContext(AdminAuthContext);
  if (value === null) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  }
  return value;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState<SafeAdminDto | null>(null);
  const [checking, setChecking] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const redirectToLogin = useCallback(() => {
    clearCurrentCsrfToken();
    router.replace(buildAdminLoginPath(pathname));
  }, [pathname, router]);

  const verifySession = useCallback(async () => {
    setChecking(true);
    setUnavailable(false);
    try {
      const [currentAdmin] = await Promise.all([
        getCurrentAdministrator(),
        fetchCsrfToken()
      ]);
      setAdmin(currentAdmin);
    } catch (error) {
      if (
        error instanceof AdminApiError &&
        (error.code === "AUTH_REQUIRED" || error.code === "SESSION_EXPIRED")
      ) {
        redirectToLogin();
        return;
      }
      setUnavailable(true);
    } finally {
      setChecking(false);
    }
  }, [redirectToLogin]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const currentAdmin = await getCurrentAdministrator();
        await fetchCsrfToken();
        if (active) {
          setAdmin(currentAdmin);
          setUnavailable(false);
          setChecking(false);
        }
      } catch (error) {
        if (!active) {
          return;
        }
        if (
          error instanceof AdminApiError &&
          (error.code === "AUTH_REQUIRED" || error.code === "SESSION_EXPIRED")
        ) {
          redirectToLogin();
        } else {
          setUnavailable(true);
        }
        setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [redirectToLogin]);

  useEffect(() => {
    window.addEventListener(ADMIN_SESSION_EXPIRED_EVENT, redirectToLogin);
    return () => window.removeEventListener(ADMIN_SESSION_EXPIRED_EVENT, redirectToLogin);
  }, [redirectToLogin]);

  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logoutAdministrator();
    } catch (error) {
      if (
        error instanceof AdminApiError &&
        (error.code === "AUTH_REQUIRED" || error.code === "SESSION_EXPIRED")
      ) {
        setAdmin(null);
        setLoggingOut(false);
        return;
      }
      setLoggingOut(false);
      throw error;
    }
    setAdmin(null);
    clearCurrentCsrfToken();
    router.replace("/admin/login");
    router.refresh();
  }, [router]);

  const contextValue = useMemo(
    () => (admin === null ? null : { admin, logout, loggingOut }),
    [admin, logout, loggingOut]
  );

  if (checking) {
    return (
      <main className="admin-gate" id="admin-main">
        <div aria-live="polite" className="admin-gate__panel" role="status">
          <span className="admin-kicker">Secure workspace</span>
          <h1>Verifying your session</h1>
          <p>Connecting to the Maglive administration service…</p>
        </div>
      </main>
    );
  }

  if (unavailable || contextValue === null) {
    return (
      <main className="admin-gate" id="admin-main">
        <div className="admin-gate__panel">
          <span className="admin-kicker">Connection interrupted</span>
          <h1>Administration is temporarily unavailable</h1>
          <p>Your session could not be verified. No changes have been made.</p>
          <button className="admin-button admin-button--primary" onClick={() => void verifySession()} type="button">
            Try again
          </button>
        </div>
      </main>
    );
  }

  return <AdminAuthContext.Provider value={contextValue}>{children}</AdminAuthContext.Provider>;
}
