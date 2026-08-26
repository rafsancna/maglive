"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  AdminApiError,
  clearCurrentCsrfToken,
  fetchCsrfToken,
  getCurrentAdministrator,
  loginAdministrator
} from "./api";

type LoginFormProps = Readonly<{ returnTo: string }>;

function errorMessage(error: unknown): string {
  if (!(error instanceof AdminApiError)) {
    return "The authentication service is unavailable. Please try again.";
  }
  if (error.code === "INVALID_CREDENTIALS") {
    return "The email or password is incorrect.";
  }
  if (error.code === "RATE_LIMITED") {
    return "Too many login attempts. Please wait before trying again.";
  }
  if (error.code === "CSRF_INVALID") {
    return "Your secure login request expired. Please try again.";
  }
  return "The authentication service is unavailable. Please try again.";
}

export function LoginForm({ returnTo }: LoginFormProps) {
  const router = useRouter();
  const errorRef = useRef<HTMLDivElement>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepareLogin(): Promise<void> {
    setPreparing(true);
    setError(null);
    clearCurrentCsrfToken();
    try {
      await getCurrentAdministrator();
      router.replace(returnTo);
      return;
    } catch (currentSessionError) {
      if (
        !(currentSessionError instanceof AdminApiError) ||
        (currentSessionError.code !== "AUTH_REQUIRED" &&
          currentSessionError.code !== "SESSION_EXPIRED")
      ) {
        setError(errorMessage(currentSessionError));
        setPreparing(false);
        return;
      }
    }

    try {
      setCsrfToken(await fetchCsrfToken());
    } catch (csrfError) {
      setError(errorMessage(csrfError));
    } finally {
      setPreparing(false);
    }
  }

  useEffect(() => {
    let active = true;
    clearCurrentCsrfToken();
    void (async () => {
      try {
        await getCurrentAdministrator();
        if (active) {
          router.replace(returnTo);
        }
        return;
      } catch (currentSessionError) {
        if (
          !(currentSessionError instanceof AdminApiError) ||
          (currentSessionError.code !== "AUTH_REQUIRED" &&
            currentSessionError.code !== "SESSION_EXPIRED")
        ) {
          if (active) {
            setError(errorMessage(currentSessionError));
            setPreparing(false);
          }
          return;
        }
      }

      try {
        const token = await fetchCsrfToken();
        if (active) {
          setCsrfToken(token);
        }
      } catch (csrfError) {
        if (active) {
          setError(errorMessage(csrfError));
        }
      } finally {
        if (active) {
          setPreparing(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [returnTo, router]);

  useEffect(() => {
    if (error !== null) {
      errorRef.current?.focus();
    }
  }, [error]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (csrfToken === null) {
      await prepareLogin();
      return;
    }

    setSubmitting(true);
    setError(null);
    const data = new FormData(event.currentTarget);
    try {
      await loginAdministrator(String(data.get("email") ?? ""), String(data.get("password") ?? ""), csrfToken);
      router.replace(returnTo);
      router.refresh();
    } catch (loginError) {
      setError(errorMessage(loginError));
      if (loginError instanceof AdminApiError && loginError.code === "CSRF_INVALID") {
        setCsrfToken(null);
        void prepareLogin();
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-login__form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="admin-field">
        <label htmlFor="admin-email">Email address</label>
        <input
          autoComplete="username"
          autoFocus
          id="admin-email"
          maxLength={254}
          name="email"
          required
          type="email"
        />
      </div>

      <div className="admin-field">
        <label htmlFor="admin-password">Password</label>
        <input
          autoComplete="current-password"
          id="admin-password"
          maxLength={1024}
          name="password"
          required
          type="password"
        />
      </div>

      {error === null ? null : (
        <div className="admin-alert" ref={errorRef} role="alert" tabIndex={-1}>
          {error}
        </div>
      )}

      <button
        className="admin-button admin-button--primary admin-login__submit"
        disabled={preparing || submitting || csrfToken === null}
        type="submit"
      >
        {submitting ? "Signing in…" : preparing ? "Preparing secure login…" : "Sign in"}
      </button>

      {error !== null && csrfToken === null && !preparing ? (
        <button className="admin-button admin-button--quiet" onClick={() => void prepareLogin()} type="button">
          Retry connection
        </button>
      ) : null}
    </form>
  );
}
