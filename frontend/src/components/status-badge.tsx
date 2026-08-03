import { cn } from "@/lib/utils";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/bookings";

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const statusMeta = BOOKING_STATUSES.find((s) => s.value === status)!;

  return (
    <span className={cn("w-fit rounded-full px-2.5 py-0.5 text-xs", statusMeta.badgeClassName, className)}>
      {statusMeta.label}
    </span>
  );
}
