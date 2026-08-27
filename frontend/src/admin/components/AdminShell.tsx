"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAdminAuth } from "../auth/AdminAuthProvider";

const navigation = [
  { href: "/admin", label: "Dashboard", marker: "01" },
  { href: "/admin/products", label: "Products", marker: "02" },
  { href: "/admin/categories", label: "Categories", marker: "03" },
  { href: "/admin/media", label: "Media", marker: "04" },
  { href: "/admin/languages", label: "Languages", marker: "05" }
] as const;

function isCurrentPath(pathname: string, href: string): boolean {
  return href === "/admin" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { admin, logout, loggingOut } = useAdminAuth();
  const currentItem = navigation.find((item) => isCurrentPath(pathname, item.href));

  return (
    <div className="admin-shell">
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

        <nav aria-label="Administration" className="admin-nav">
          {navigation.map((item) => (
            <Link
              aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
              href={item.href}
              key={item.href}
            >
              <span aria-hidden="true">{item.marker}</span>
              {item.label}
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
