import { AdminRouteIntro } from "@/admin/components/AdminRouteIntro";
import { SeoDashboard } from "@/admin/seo/SeoDashboard";

export default function AdminSeoPage() {
  return <AdminRouteIntro eyebrow="SEO" title="Search health" text="Review localized scores, rendered-page checks, and connected provider status."><SeoDashboard /></AdminRouteIntro>;
}
