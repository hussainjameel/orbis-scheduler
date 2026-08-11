import { Building2, Hourglass, CalendarCheck, CalendarDays, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminStats } from "@/lib/admin";

function StatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border border-border-default bg-surface-2 p-4">
      <div className={cn("flex size-9 items-center justify-center rounded-md", iconClassName)}>
        <Icon className="size-5" strokeWidth={1.5} />
      </div>
      <p className="mt-3 text-2xl font-medium text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary">{label}</p>
    </div>
  );
}

// Pending is the one figure that needs attention, so it gets the real
// status colour pair — same reasoning as the owner dashboard's stat cards.
// Total/lifetime/this-week aren't tied to a status, so they stay neutral.
export function AdminStatCards({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard
        icon={Building2}
        iconClassName="bg-surface-1 text-text-secondary"
        label="Total businesses"
        value={stats.totalBusinesses}
      />
      <StatCard
        icon={Hourglass}
        iconClassName="bg-pending text-pending-text"
        label="Pending review"
        value={stats.pendingRegistrations}
      />
      <StatCard
        icon={CalendarCheck}
        iconClassName="bg-surface-1 text-text-secondary"
        label="Lifetime bookings"
        value={stats.totalBookingsLifetime}
      />
      <StatCard
        icon={CalendarDays}
        iconClassName="bg-surface-1 text-text-secondary"
        label="Bookings this week"
        value={stats.bookingsThisWeek}
      />
    </div>
  );
}

function BreakdownCard({ dotClassName, label, count }: { dotClassName: string; label: string; count: number }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border-default bg-surface-2 p-4">
      <span className={cn("size-2.5 shrink-0 rounded-full", dotClassName)} />
      <p className="flex-1 text-sm text-text-secondary">{label}</p>
      <p className="text-xl font-medium text-text-primary">{count}</p>
    </div>
  );
}

// approvedBusinesses counts every business with approvalStatus:'approved',
// which includes currently-suspended ones (suspension doesn't change
// approvalStatus) — so this row won't partition cleanly against Suspended.
// Shown as the backend actually defines it (decision 1: server is the
// source of truth) rather than a derived "active-approved" figure the API
// doesn't provide.
export function AdminStatusBreakdown({ stats }: { stats: AdminStats }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <BreakdownCard dotClassName="bg-approved-text" label="Approved" count={stats.approvedBusinesses} />
      <BreakdownCard dotClassName="bg-rejected-text" label="Rejected" count={stats.rejectedBusinesses} />
      <BreakdownCard dotClassName="bg-cancelled-text" label="Suspended" count={stats.suspendedBusinesses} />
    </div>
  );
}
