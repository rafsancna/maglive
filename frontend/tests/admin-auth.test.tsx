import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/admin/auth/api";
import { AdminAuthProvider } from "@/admin/auth/AdminAuthProvider";
import { LoginForm } from "@/admin/auth/LoginForm";
import { AdminShell } from "@/admin/components/AdminShell";

const navigation = vi.hoisted(() => ({
  pathname: "/admin/categories",
  replace: vi.fn(),
  refresh: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace, refresh: navigation.refresh })
}));

const admin = {
  id: "507f1f77bcf86cd799439011",
  email: "admin@example.com",
  role: "admin" as const
};

beforeEach(() => {
  navigation.pathname = "/admin/categories";
  navigation.replace.mockReset();
  navigation.refresh.mockReset();
  authApi.clearCurrentCsrfToken();
  window.localStorage.clear();
});

describe("administrator login", () => {
  it("shows local credentials and toggles password visibility", async () => {
    vi.spyOn(authApi, "getCurrentAdministrator").mockRejectedValue(
      new authApi.AdminApiError(401, "AUTH_REQUIRED", "Authentication required")
    );
    vi.spyOn(authApi, "fetchCsrfToken").mockResolvedValue("pre-auth-csrf-token-value-00000001");
    const user = userEvent.setup();

    render(
      <LoginForm
        credentialHint={{ email: "admin@example.com", password: "Maglive Local Admin 2026!" }}
        returnTo="/admin"
      />
    );

    expect(screen.getByLabelText("Development login credentials")).toHaveTextContent(
      "admin@example.com"
    );
    expect(screen.getByLabelText("Development login credentials")).toHaveTextContent(
      "Maglive Local Admin 2026!"
    );
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("checkbox", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
  });

  it("acquires pre-auth CSRF, logs in, and follows the validated return path", async () => {
    vi.spyOn(authApi, "getCurrentAdministrator").mockRejectedValue(
      new authApi.AdminApiError(401, "AUTH_REQUIRED", "Authentication required")
    );
    vi.spyOn(authApi, "fetchCsrfToken").mockResolvedValue("pre-auth-csrf-token-value-00000001");
    const login = vi.spyOn(authApi, "loginAdministrator").mockResolvedValue({
      admin,
      csrfToken: "authenticated-csrf-token-value-000001"
    });
    const user = userEvent.setup();

    render(<LoginForm returnTo="/admin/categories" />);
    const submit = await screen.findByRole("button", { name: "Sign in" });
    await user.type(screen.getByLabelText("Email address"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "correct password");
    await user.click(submit);

    expect(login).toHaveBeenCalledWith(
      "admin@example.com",
      "correct password",
      "pre-auth-csrf-token-value-00000001"
    );
    expect(navigation.replace).toHaveBeenCalledWith("/admin/categories");
    expect(navigation.refresh).toHaveBeenCalled();
  });

  it("shows and focuses the generic invalid-credential state", async () => {
    vi.spyOn(authApi, "getCurrentAdministrator").mockRejectedValue(
      new authApi.AdminApiError(401, "AUTH_REQUIRED", "Authentication required")
    );
    vi.spyOn(authApi, "fetchCsrfToken").mockResolvedValue("pre-auth-csrf-token-value-00000001");
    vi.spyOn(authApi, "loginAdministrator").mockRejectedValue(
      new authApi.AdminApiError(401, "INVALID_CREDENTIALS", "Invalid")
    );
    const user = userEvent.setup();

    render(<LoginForm returnTo="/admin" />);
    await user.type(screen.getByLabelText("Email address"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "incorrect password");
    await user.click(await screen.findByRole("button", { name: "Sign in" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The email or password is incorrect.");
    expect(alert).toHaveFocus();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});

describe("protected administrator shell", () => {
  it("verifies the session and exposes accessible current navigation", async () => {
    vi.spyOn(authApi, "getCurrentAdministrator").mockResolvedValue(admin);
    vi.spyOn(authApi, "fetchCsrfToken").mockResolvedValue("authenticated-csrf-token-value-000001");

    render(
      <AdminAuthProvider>
        <AdminShell><h1>Category workspace</h1></AdminShell>
      </AdminAuthProvider>
    );

    expect(await screen.findByText("admin@example.com")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Administration" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Categories/ })).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(screen.getByRole("link", { name: /Products/ })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("button", { name: "Log out" })).toBeEnabled();
  });

  it("collapses the dashboard navigation and remembers the preference", async () => {
    vi.spyOn(authApi, "getCurrentAdministrator").mockResolvedValue(admin);
    vi.spyOn(authApi, "fetchCsrfToken").mockResolvedValue("authenticated-csrf-token-value-000001");
    const user = userEvent.setup();

    const { container } = render(
      <AdminAuthProvider>
        <AdminShell><h1>Category workspace</h1></AdminShell>
      </AdminAuthProvider>
    );

    await screen.findByText("admin@example.com");
    await user.click(screen.getByRole("button", { name: "Collapse dashboard navigation" }));

    expect(container.querySelector(".admin-shell")).toHaveClass("admin-shell--collapsed");
    expect(screen.getByRole("button", { name: "Expand dashboard navigation" })).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(window.localStorage.getItem("maglive.admin.sidebar-collapsed")).toBe("true");
  });

  it("preserves the current route when a global session-expiry event occurs", async () => {
    vi.spyOn(authApi, "getCurrentAdministrator").mockResolvedValue(admin);
    vi.spyOn(authApi, "fetchCsrfToken").mockResolvedValue("authenticated-csrf-token-value-000001");
    render(
      <AdminAuthProvider>
        <AdminShell><h1>Category workspace</h1></AdminShell>
      </AdminAuthProvider>
    );
    await screen.findByText("admin@example.com");

    window.dispatchEvent(new Event(authApi.ADMIN_SESSION_EXPIRED_EVENT));
    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        "/admin/login?returnTo=%2Fadmin%2Fcategories"
      );
    });
  });
});
