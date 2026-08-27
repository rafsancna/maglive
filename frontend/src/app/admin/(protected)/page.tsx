import { AdminRouteIntro } from "@/admin/components/AdminRouteIntro";

const modules = [
  ["Products", "Phase 5–7", "Author, preview, and publish multilingual technical products."],
  ["Categories", "Phase 3", "Organize the two-level public product taxonomy."],
  ["Media", "Phase 4", "Upload and safely reuse product images, videos, and documents."],
  ["Languages", "Localization", "Enable languages for public routes and multilingual editorial workflows."]
] as const;

export default function AdminDashboardPage() {
  return (
    <AdminRouteIntro
      eyebrow="Dashboard"
      text="Authentication is active. Editorial modules will unlock in their verified implementation phases."
      title="A controlled workspace for product publishing."
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
