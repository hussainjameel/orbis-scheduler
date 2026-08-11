import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function StatusRow({ done, label, href }: { done: boolean; label: string; href: string }) {
  if (done) {
    return (
      <div className="flex items-center gap-2 py-2">
        <CheckCircle2 className="size-4 shrink-0 text-approved-text" strokeWidth={1.5} />
        <span className="text-sm text-text-primary">{label}</span>
      </div>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-sm py-2 text-text-secondary transition-colors hover:text-text-primary"
      )}
    >
      <Circle className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
      <span className="flex-1 text-sm">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
    </Link>
  );
}

export function SetupStatusCard({
  availabilitySet,
  formCustomized,
}: {
  availabilitySet: boolean;
  formCustomized: boolean;
}) {
  return (
    <div className="rounded-md border border-border-default bg-surface-2 p-4">
      <h2 className="text-xl font-medium text-text-primary">Setup</h2>
      <div className="mt-1 flex flex-col divide-y divide-border-default">
        <StatusRow done={availabilitySet} label="Availability set" href="/dashboard/availability" />
        <StatusRow done={formCustomized} label="Booking form customized" href="/dashboard/form" />
      </div>
    </div>
  );
}
