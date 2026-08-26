import type { ReactNode } from "react";
import { AdminAuthProvider } from "@/admin/auth/AdminAuthProvider";
import { AdminShell } from "@/admin/components/AdminShell";

export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
