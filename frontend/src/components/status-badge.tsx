import { cn } from "@/lib/utils";
import { BOOKING_STATUSES, type BookingStatus } from "@/lib/bookings";

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: BookingStatus;
  // Overrides the displayed text while keeping status's colour pair — e.g. a
  // suspended business reuses the Cancelled colour pair but reads "Suspended".
  label?: string;
  className?: string;
}) {
  const statusMeta = BOOKING_STATUSES.find((s) => s.value === status)!;

  return (
    <span className={cn("w-fit rounded-full px-2.5 py-0.5 text-xs", statusMeta.badgeClassName, className)}>
      {label ?? statusMeta.label}
    </span>
  );
}
