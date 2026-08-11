"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { BUSINESS_STATUS_FILTERS } from "@/lib/admin";

// Same pill shape/active-inactive classes as owner bookings'
// status-filter-pills.tsx, without count badges — GET /admin/businesses
// doesn't return per-status counts, and /admin/stats' counts overlap
// (a suspended business is counted under both Approved and Suspended
// there), which would make a badge disagree with the row count you see
// after clicking it.
function currentFilterValue(searchParams: URLSearchParams): string {
  const status = searchParams.get("status");
  const isActive = searchParams.get("isActive");
  const match = BUSINESS_STATUS_FILTERS.find(
    (f) => f.status === (status ?? undefined) && (f.isActive === undefined ? isActive === null : String(f.isActive) === isActive)
  );
  return match?.value ?? "all";
}

export function StatusFilterPills() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = currentFilterValue(searchParams);

  function hrefFor(filter: (typeof BUSINESS_STATUS_FILTERS)[number]) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("status");
    params.delete("isActive");
    if (filter.status) params.set("status", filter.status);
    if (filter.isActive !== undefined) params.set("isActive", String(filter.isActive));
    params.delete("page");
    return `${pathname}?${params.toString()}`;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {BUSINESS_STATUS_FILTERS.map((filter) => {
        const active = filter.value === current;

        return (
          <Link
            key={filter.value}
            href={hrefFor(filter)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition-colors",
              active
                ? "bg-text-primary text-surface-0"
                : "border border-border-strong bg-surface-2 text-text-secondary hover:bg-surface-1"
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
