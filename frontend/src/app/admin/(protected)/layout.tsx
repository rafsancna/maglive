import type { ReactNode } from "react";
import { AdminAuthProvider } from "@/admin/auth/AdminAuthProvider";
import { AdminShell } from "@/admin/components/AdminShell";
import { LanguageProvider } from "@/admin/languages/LanguageProvider";

export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <LanguageProvider>
        <AdminShell>{children}</AdminShell>
      </LanguageProvider>
    </AdminAuthProvider>
  );
}
