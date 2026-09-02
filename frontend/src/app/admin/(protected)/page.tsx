import { AdminRouteIntro } from "@/admin/components/AdminRouteIntro";

const modules = [
  ["Products", "Phase 5–7", "Author, preview, and publish multilingual technical products."],
  ["News", "Editorial", "Create and publish multilingual news with rich media, documents, and full SEO."],
  ["Categories", "Phase 3", "Organize the two-level public product taxonomy."],
  ["Media", "Phase 4", "Upload and safely reuse product images, videos, and documents."],
  ["Navigation", "Content control", "Manage navbar labels, menu links, hover cards, ordering, visibility, and imagery."],
  ["Languages", "Localization", "Enable languages for public routes and multilingual editorial workflows."],
  ["SEO", "Optimization", "Review localized SEO scores, rendered audits, and search provider status."],
] as const;

export default function AdminDashboardPage() {
  return (
    <AdminRouteIntro
      eyebrow="Dashboard"
      text="Manage multilingual products, news, media, navigation, and search visibility from one controlled workspace."
      title="A controlled workspace for digital publishing."
    >
      <div className="admin-module-grid">
        {modules.map(([name, phase, description]) => (
          <article className="admin-module-card" key={name}>
            <span>{phase}</span>
            <h2>{name}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </AdminRouteIntro>
  );
}
