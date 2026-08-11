import Link from "next/link";
import { CheckCircle2, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PendingCallout({ pendingCount }: { pendingCount: number }) {
  if (pendingCount === 0) {
    return (
      <div className="rounded-md border border-border-default bg-surface-2 p-4">
        <CheckCircle2 className="size-5 text-approved-text" strokeWidth={1.5} />
        <h2 className="mt-3 text-xl font-medium text-text-primary">All caught up</h2>
        <p className="mt-1 text-sm text-text-secondary">No business registrations are waiting on a decision.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border-default bg-surface-2 p-4">
      <ClipboardList className="size-5 text-pending-text" strokeWidth={1.5} />
      <h2 className="mt-3 text-xl font-medium text-text-primary">
        {pendingCount} registration{pendingCount === 1 ? "" : "s"} need{pendingCount === 1 ? "s" : ""} a decision
      </h2>
      <p className="mt-1 text-sm text-text-secondary">
        New businesses are waiting for approval before they can go live.
      </p>
      <Button
        render={<Link href="/admin/businesses?status=pending">Review businesses</Link>}
        nativeButton={false}
        className="mt-3"
      />
    </div>
  );
}
