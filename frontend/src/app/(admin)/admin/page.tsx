import { apiFetch } from "@/lib/api";
import type { AdminStats } from "@/lib/admin";
import { AdminStatCards, AdminStatusBreakdown } from "./stat-cards";
import { PendingCallout } from "./pending-callout";

export default async function AdminOverviewPage() {
  const stats = await apiFetch<AdminStats>("/admin/stats");

  return (
    <div className="flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-medium text-text-primary">Overview</h1>
        <p className="text-sm text-text-secondary">Platform-wide activity across every business.</p>
      </div>

      <div className="flex flex-col gap-4">
        <AdminStatCards stats={stats} />
        <AdminStatusBreakdown stats={stats} />
        <PendingCallout pendingCount={stats.pendingRegistrations} />
      </div>
    </div>
  );
}
