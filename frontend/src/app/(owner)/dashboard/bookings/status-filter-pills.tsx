"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOOKING_STATUSES, type BookingCounts } from "@/lib/bookings";

const PILLS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  ...BOOKING_STATUSES.map(({ value, label }) => ({ value, label })),
];

export function StatusFilterPills({ counts }: { counts: BookingCounts }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "pending";

  function hrefFor(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", value);
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PILLS.map((pill) => {
        const active = pill.value === currentStatus;
        const count = counts[pill.value as keyof BookingCounts];

        return (
          <Link
            key={pill.value}
            href={hrefFor(pill.value)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-colors",
              active
                ? "bg-text-primary text-surface-0"
                : "border border-border-strong bg-surface-2 text-text-secondary hover:bg-surface-1"
            )}
          >
            {pill.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs",
                active ? "bg-surface-0/20 text-surface-0" : "bg-surface-0 text-text-muted"
              )}
            >
              {count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
