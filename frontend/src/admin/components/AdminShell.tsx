"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useSyncExternalStore } from "react";
import { useAdminAuth } from "../auth/AdminAuthProvider";

const SIDEBAR_STORAGE_KEY = "maglive.admin.sidebar-collapsed";
const SIDEBAR_CHANGE_EVENT = "maglive-admin-sidebar-change";

type NavIcon = "dashboard" | "products" | "news" | "categories" | "media" | "navigation" | "languages" | "seo";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/products", label: "Products", icon: "products" },
  { href: "/admin/news", label: "News", icon: "news" },
  { href: "/admin/categories", label: "Categories", icon: "categories" },
  { href: "/admin/media", label: "Media", icon: "media" },
  { href: "/admin/navigation", label: "Navigation", icon: "navigation" },
  { href: "/admin/languages", label: "Languages", icon: "languages" },
  { href: "/admin/seo", label: "SEO", icon: "seo" },
] as const;

function NavIcon({ name }: { name: NavIcon }) {
  return (
    <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20">
      {name === "dashboard" ? (
        <path d="M3 3h6v6H3zM11 3h6v6h-6zM3 11h6v6H3zM11 11h6v6h-6z" />
      ) : null}
      {name === "products" ? (
        <>
          <path d="M10 2.4 17 6.1v7.8L10 17.6 3 13.9V6.1L10 2.4z" />
          <path d="m3 6.1 7 3.7 7-3.7M10 9.8v7.8" />
        </>
      ) : null}
      {name === "news" ? (
        <>
          <path d="M11.4 2.6H5.8a1 1 0 0 0-1 1v12.8a1 1 0 0 0 1 1h8.4a1 1 0 0 0 1-1V7.2l-3.8-4.6z" />
          <path d="M11.4 2.6v4.6h3.8M7.4 11h5.2M7.4 14h3.4" />
        </>
      ) : null}
      {name === "categories" ? (
        <path d="M2.6 5.4a1 1 0 0 1 1-1h3.9l1.5 1.9h7.4a1 1 0 0 1 1 1v7.3a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V5.4z" />
      ) : null}
      {name === "media" ? (
        <>
          <path d="M2.6 4.6a1 1 0 0 1 1-1h12.8a1 1 0 0 1 1 1v10.8a1 1 0 0 1-1 1H3.6a1 1 0 0 1-1-1V4.6z" />
          <path d="m2.9 13.4 4-3.8 3.2 3 2.3-2.2 4.7 4.4" />
          <circle cx="13.4" cy="6.8" r="1.2" />
        </>
      ) : null}
      {name === "navigation" ? (
        <>
          <circle cx="10" cy="10" r="7.4" />
          <path d="m12.9 7.1-1.7 4.1-4.1 1.7 1.7-4.1 4.1-1.7z" />
        </>
      ) : null}
      {name === "languages" ? (
        <>
          <circle cx="10" cy="10" r="7.4" />
          <path d="M2.6 10h14.8M10 2.6c2.5 2.8 2.5 12 0 14.8M10 2.6c-2.5 2.8-2.5 12 0 14.8" />
        </>
      ) : null}
      {name === "seo" ? (
        <>
          <path d="m2.8 14.6 4.6-4.5 3.2 3.2 6.6-7.2" />
          <path d="M12.9 6.1h4.3v4.3" />
        </>
      ) : null}
    </svg>
  );
}

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
          <span className="admin-brand__wordmark">
            <strong>MAGLIVE</strong>
            <small>Admin</small>
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
          {navigation.map((item) => {
            const current = isCurrentPath(pathname, item.href);
            return (
              <Link
                aria-current={current ? "page" : undefined}
                aria-label={item.label}
                href={item.href}
                key={item.href}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <span className="admin-nav__icon">
                  <NavIcon name={item.icon} />
                </span>
                <span className="admin-nav__label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <span aria-hidden="true" className="admin-sidebar__avatar">{admin.email.slice(0, 1).toUpperCase()}</span>
          <strong className="admin-sidebar__email">{admin.email}</strong>
          <button
            className="admin-logout"
            disabled={loggingOut}
            onClick={() => void logout()}
            type="button"
          >
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20">
              <path d="M8 3H5.2a1.2 1.2 0 0 0-1.2 1.2v11.6A1.2 1.2 0 0 0 5.2 17H8M13 6.6 16.4 10 13 13.4M16.4 10H7.6" />
            </svg>
            <span>{loggingOut ? "Signing out…" : "Log out"}</span>
          </button>
        </div>
      </aside>

      <div className="admin-workspace">
        <header className="admin-topbar">
          <strong className="admin-topbar__title">{currentItem?.label ?? "Administration"}</strong>
          <a className="admin-topbar__link" href="/" rel="noreferrer" target="_blank">
            View website
            <svg aria-hidden="true" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 20 20">
              <path d="M6 14 14 6M8 6h6v6" />
            </svg>
          </a>
        </header>
        <main className="admin-main" id="admin-main">{children}</main>
      </div>
    </div>
  );
}
