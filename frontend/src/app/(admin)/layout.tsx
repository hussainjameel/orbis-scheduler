import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { apiFetch } from "@/lib/api";
import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminMobileNav } from "@/components/admin-mobile-nav";

type AdminProfile = { name: string; email: string };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  // A valid session on the wrong role's routes is a silent redirect, not an
  // error page (decision 13) — same rule as (owner)/layout.tsx.
  if (session.role !== "admin") redirect("/dashboard");

  const { admin } = await apiFetch<{ admin: AdminProfile }>("/admin/me");

  return (
    <div className="flex h-screen flex-col overflow-hidden sm:flex-row">
      <AdminSidebar adminEmail={admin.email} />
      <AdminMobileNav />
      <main className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 pb-24 sm:px-8 sm:py-8 sm:pb-8">{children}</main>
    </div>
  );
}
