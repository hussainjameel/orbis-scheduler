import type { ReactNode } from "react";
import Link from "next/link";
import { Building2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatBookingDate } from "@/lib/bookings";
import { businessDisplayStatus, type AdminBusinessesResponse, type BusinessApprovalStatus } from "@/lib/admin";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { StatusFilterPills } from "./status-filter-pills";
import { BusinessSearch } from "./business-search";

const PAGE_SIZE = 25;
const VALID_STATUSES: BusinessApprovalStatus[] = ["pending", "approved", "rejected"];

const GRID_COLS = "grid grid-cols-[1.5fr_1.5fr_110px_100px] items-center gap-3 px-3 py-2";

export default async function BusinessesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; isActive?: string; search?: string; page?: string }>;
}) {
  const sp = await searchParams;

  const status = VALID_STATUSES.includes(sp.status as BusinessApprovalStatus)
    ? (sp.status as BusinessApprovalStatus)
    : undefined;
  const isActive = sp.isActive === "true" || sp.isActive === "false" ? sp.isActive : undefined;
  const search = typeof sp.search === "string" ? sp.search.trim() : "";

  const parsedPage = Number(sp.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (isActive) qs.set("isActive", isActive);
  if (search) qs.set("search", search);
  if (page > 1) qs.set("page", String(page));

  let data: AdminBusinessesResponse;
  try {
    data = await apiFetch<AdminBusinessesResponse>(`/admin/businesses?${qs.toString()}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      throw err;
    }
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-medium text-text-primary">Businesses</h1>
        <div className="rounded-md border border-border-default bg-surface-2">
          <ErrorState body="Couldn't load businesses. Please try again." />
        </div>
      </div>
    );
  }

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (isActive) params.set("isActive", isActive);
    if (search) params.set("search", search);
    if (targetPage > 1) params.set("page", String(targetPage));
    return `/admin/businesses?${params.toString()}`;
  }

  const showingFrom = data.total === 0 ? 0 : (data.page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(data.page * PAGE_SIZE, data.total);
  const isFirstPage = data.page <= 1;
  const isLastPage = data.page >= data.totalPages;

  let content: ReactNode;
  if (data.total === 0 && !search && !status && !isActive) {
    content = (
      <EmptyState icon={Building2} heading="No businesses yet" body="Registered businesses will appear here." />
    );
  } else if (data.businesses.length === 0) {
    content = <EmptyState body="No businesses match your filters." />;
  } else {
    content = (
      <>
        <div className="hidden sm:block">
          <div className={cn(GRID_COLS, "bg-surface-1 text-xs font-medium text-text-muted")}>
            <span>Business</span>
            <span>Owner</span>
            <span>Status</span>
            <span>Bookings</span>
          </div>
          {data.businesses.map((business) => {
            const display = businessDisplayStatus(business);
            return (
              <Link
                key={business.id}
                href={`/admin/businesses/${business.id}`}
                className={cn(
                  GRID_COLS,
                  "cursor-pointer border-t border-border-default text-sm text-text-primary hover:bg-surface-1"
                )}
              >
                <span className="min-w-0 truncate">{business.name}</span>
                <span className="min-w-0 truncate text-text-secondary">
                  {business.ownerName} <span className="text-text-muted">· {business.ownerEmail}</span>
                </span>
                <span>
                  <StatusBadge status={display.status} label={display.label} />
                </span>
                <span className="tabular text-text-secondary">{business.totalBookings}</span>
              </Link>
            );
          })}
        </div>

        <div className="sm:hidden">
          {data.businesses.map((business) => {
            const display = businessDisplayStatus(business);
            return (
              <Link
                key={business.id}
                href={`/admin/businesses/${business.id}`}
                className="block min-h-11 border-t border-border-default px-3 py-3 first:border-t-0 hover:bg-surface-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-text-primary">{business.name}</span>
                  <StatusBadge status={display.status} label={display.label} className="shrink-0" />
                </div>
                <p className="mt-1 text-sm text-text-secondary">{business.ownerName}</p>
                <p className="mt-0.5 text-xs text-text-muted">{business.ownerEmail}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {business.totalBookings} booking{business.totalBookings === 1 ? "" : "s"} · Registered{" "}
                  {formatBookingDate(business.createdAt)}
                </p>
              </Link>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="mb-1 text-2xl font-medium text-text-primary">Businesses</h1>
          <p className="text-sm text-text-secondary">Every business on the platform, across all tenants.</p>
        </div>
        <BusinessSearch />
      </div>

      <div className="flex flex-col gap-4">
        <StatusFilterPills />

        <div className="rounded-md border border-border-default bg-surface-2">{content}</div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            Showing {showingFrom}–{showingTo} of {data.total}
          </p>
          <div className="flex gap-2">
            {isFirstPage ? (
              <span className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "pointer-events-none opacity-50")}>
                Previous
              </span>
            ) : (
              <Link href={pageHref(data.page - 1)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Previous
              </Link>
            )}
            {isLastPage ? (
              <span className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "pointer-events-none opacity-50")}>
                Next
              </span>
            ) : (
              <Link href={pageHref(data.page + 1)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                Next
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
