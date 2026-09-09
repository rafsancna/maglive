import Link from "next/link";
import { AdminRouteIntro } from "@/admin/components/AdminRouteIntro";
import { SiteIconSettings } from "@/admin/site-settings/SiteIconSettings";

const modules = [
  { href: "/admin/products", label: "Products", description: "Author, preview, and publish multilingual product pages." },
  { href: "/admin/news", label: "News", description: "Write and publish multilingual stories with media and SEO." },
  { href: "/admin/categories", label: "Categories", description: "Organize the two-level public product taxonomy." },
  { href: "/admin/media", label: "Media", description: "Upload and safely reuse images, videos, and documents." },
  { href: "/admin/navigation", label: "Navigation", description: "Manage navbar labels, links, and ordering." },
  { href: "/admin/languages", label: "Languages", description: "Enable locales for public and editorial workflows." },
  { href: "/admin/seo", label: "SEO", description: "Review scores, audits, and provider status." },
] as const;

export default function AdminDashboardPage() {
  return (
    <AdminRouteIntro eyebrow="Overview" title="Dashboard">
      <div className="admin-module-grid">
        {modules.map((module) => (
          <Link className="admin-module-card admin-module-card--link" href={module.href} key={module.href}>
            <h2>{module.label}</h2>
            <p>{module.description}</p>
            <span aria-hidden="true" className="admin-module-card__arrow">
              <svg fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 20 20">
                <path d="M5 15 15 5M8.5 5H15v6.5" />
              </svg>
            </span>
          </Link>
        ))}
      </div>
      <SiteIconSettings />
    </AdminRouteIntro>
  );
}
