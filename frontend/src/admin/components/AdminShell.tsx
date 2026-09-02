"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useSyncExternalStore } from "react";
import { useAdminAuth } from "../auth/AdminAuthProvider";

const SIDEBAR_STORAGE_KEY = "maglive.admin.sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "maglive-admin-sidebar-change";

const navigation = [
  { href: "/admin", label: "Dashboard", marker: "01" },
  { href: "/admin/products", label: "Products", marker: "02" },
  { href: "/admin/news", label: "News", marker: "03" },
  { href: "/admin/categories", label: "Categories", marker: "04" },
  { href: "/admin/media", label: "Media", marker: "05" },
  { href: "/admin/navigation", label: "Navigation", marker: "06" },
  { href: "/admin/languages", label: "Languages", marker: "07" },
  { href: "/admin/seo", label: "SEO", marker: "08" },
] as const;

function isCurrentPath(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function getSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function subscribeToSidebarPreference(onStoreChange: () => void): () => void {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(SIDEBAR_CHANGE_EVENT, onStoreChange);
  };
}

function setSidebarCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  } catch {
    // The dashboard still works when storage is unavailable or restricted.
  }
  window.dispatchEvent(new Event(SIDEBAR_CHANGE_EVENT));
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { admin, logout, loggingOut } = useAdminAuth();
  const currentItem = navigation.find((item) => isCurrentPath(pathname, item.href));
  const sidebarCollapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarCollapsed,
    () => false
  );

  return (
    <div className={`admin-shell${sidebarCollapsed ? " admin-shell--collapsed" : ""}`}>
      <a className="skip-link" href="#admin-main">
        Skip to administration content
      </a>
      <aside className="admin-sidebar">
        <Link aria-label="Maglive administration dashboard" className="admin-brand" href="/admin">
          <span aria-hidden="true" className="admin-brand__mark">M</span>
          <span>
            <strong>MAGLIVE</strong>
            <small>Administration</small>
          </span>
        </Link>

        <button
          aria-controls="admin-navigation"
          aria-expanded={!sidebarCollapsed}
          aria-label={sidebarCollapsed ? "Expand dashboard navigation" : "Collapse dashboard navigation"}
          className="admin-sidebar__toggle"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d={sidebarCollapsed ? "m6 3 5 5-5 5" : "m10 3-5 5 5 5"} />
          </svg>
        </button>

        <nav aria-label="Administration" className="admin-nav" id="admin-navigation">
          {navigation.map((item) => (
            <Link
              aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
              aria-label={item.label}
              href={item.href}
              key={item.href}
              title={sidebarCollapsed ? item.label : undefined}
            >
              <span aria-hidden="true" className="admin-nav__marker">{item.marker}</span>
              <span className="admin-nav__label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="admin-sidebar__footer">
          <span>Signed in as</span>
          <strong>{admin.email}</strong>
          <button
            className="admin-logout"
            disabled={loggingOut}
            onClick={() => void logout()}
            type="button"
          >
            {loggingOut ? "Signing out…" : "Log out"}
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <div>
            <span className="admin-kicker">Content operations</span>
            <strong>{currentItem?.label ?? "Administration"}</strong>
          </div>
          <span className="admin-environment">Version-one workspace</span>
        </header>
        <main className="admin-main" id="admin-main">{children}</main>
      </div>
    </div>
  );
}
