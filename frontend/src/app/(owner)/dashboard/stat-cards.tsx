import { Hourglass, CheckCircle2, CalendarCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BookingCounts } from "@/lib/bookings";

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

// Pending and Approved use their real status colour pairs — the badge
// colour literally is that status's count, not decoration, so this doesn't
// run afoul of "status colour is for status only." Total isn't tied to one
// status, so it gets a neutral treatment instead.
export function StatCards({ counts }: { counts: BookingCounts }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <StatCard icon={Hourglass} iconClassName="bg-pending text-pending-text" label="Pending review" value={counts.pending} />
      <StatCard icon={CheckCircle2} iconClassName="bg-approved text-approved-text" label="Approved" value={counts.approved} />
      <StatCard icon={CalendarCheck} iconClassName="bg-surface-1 text-text-secondary" label="Total bookings" value={counts.all} />
    </div>
  );
}
