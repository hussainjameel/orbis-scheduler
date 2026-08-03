import type { ReactNode } from "react";
import Link from "next/link";
import { List } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUSES,
  formatBookingDate,
  formatBookingTime,
  formatRelativeTime,
  type BookingStatus,
  type BookingsResponse,
} from "@/lib/bookings";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { StatusBadge } from "@/components/status-badge";
import { StatusFilterPills } from "./status-filter-pills";
import { BookingSearch } from "./booking-search";

const PAGE_SIZE = 25;
const VALID_STATUSES = BOOKING_STATUSES.map((s) => s.value);

const GRID_COLS = "grid grid-cols-[1.5fr_1fr_110px_120px] items-center gap-3 px-3 py-2";

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; search?: string; page?: string }>;
}) {
  const sp = await searchParams;

  const resolvedStatus: BookingStatus | "all" =
    sp.status === "all"
      ? "all"
      : VALID_STATUSES.includes(sp.status as BookingStatus)
        ? (sp.status as BookingStatus)
        : "pending";

  const search = typeof sp.search === "string" ? sp.search.trim() : "";

  const parsedPage = Number(sp.page);
  const page = Number.isInteger(parsedPage) && parsedPage >= 1 ? parsedPage : 1;

  const qs = new URLSearchParams();
  if (resolvedStatus !== "all") qs.set("status", resolvedStatus);
  if (search) qs.set("search", search);
  if (page > 1) qs.set("page", String(page));

  let data: BookingsResponse;
  try {
    data = await apiFetch<BookingsResponse>(`/owner/bookings?${qs.toString()}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      throw err;
    }
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-medium text-text-primary">Bookings</h1>
        <div className="rounded-md border border-border-default bg-surface-2">
          <ErrorState body="Couldn't load your bookings. Please try again." />
        </div>
      </div>
    );
  }

  const { counts } = data;

  function pageHref(targetPage: number) {
    const params = new URLSearchParams();
    params.set("status", resolvedStatus);
    if (search) params.set("search", search);
    if (targetPage > 1) params.set("page", String(targetPage));
    return `/dashboard/bookings?${params.toString()}`;
  }

  const showingFrom = data.total === 0 ? 0 : (data.page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(data.page * PAGE_SIZE, data.total);
  const isFirstPage = data.page <= 1;
  const isLastPage = data.page >= data.totalPages;

  let content: ReactNode;
  if (counts.all === 0 && !search) {
    content = (
      <EmptyState
        icon={List}
        heading="No bookings yet"
        body="Share your booking link and they'll appear here as customers request times."
        action={<Button render={<Link href="/dashboard/share">Get your booking link</Link>} />}
      />
    );
  } else if (data.bookings.length === 0) {
    content = <EmptyState body="No bookings with this status." />;
  } else {
    content = (
      <>
        <div className="hidden sm:block">
          <div className={cn(GRID_COLS, "bg-surface-1 text-xs font-medium text-text-muted")}>
            <span>Customer</span>
            <span>Date & time</span>
            <span>Status</span>
            <span>Requested</span>
          </div>
          {data.bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/dashboard/bookings/${booking.id}?from=${resolvedStatus}`}
              className={cn(
                GRID_COLS,
                "cursor-pointer border-t border-border-default text-sm text-text-primary hover:bg-surface-1"
              )}
            >
              <span className="min-w-0 truncate">{booking.customerName}</span>
              <span className="tabular min-w-0 truncate text-text-secondary">
                {formatBookingDate(booking.bookingDate)} · {formatBookingTime(booking.bookingTime)}
              </span>
              <span>
                <StatusBadge status={booking.status} />
              </span>
              <span className="text-xs text-text-muted">{formatRelativeTime(booking.createdAt)}</span>
            </Link>
          ))}
        </div>

        <div className="sm:hidden">
          {data.bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/dashboard/bookings/${booking.id}?from=${resolvedStatus}`}
              className="block min-h-11 border-t border-border-default px-3 py-3 first:border-t-0 hover:bg-surface-1"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text-primary">{booking.customerName}</span>
                <StatusBadge status={booking.status} className="shrink-0" />
              </div>
              <p className="tabular mt-1 text-sm text-text-secondary">
                {formatBookingDate(booking.bookingDate)} · {formatBookingTime(booking.bookingTime)}
              </p>
              <p className="mt-1 text-xs text-text-muted">{booking.customerEmail}</p>
              <p className="mt-0.5 text-xs text-text-muted">{formatRelativeTime(booking.createdAt)}</p>
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium text-text-primary">Bookings</h1>
          <p className="mt-1 text-sm">
            <span className="font-medium text-pending-text">{counts.pending} pending</span>
            <span className="text-text-secondary"> · {counts.approved} approved · {counts.all} total</span>
          </p>
        </div>
        <BookingSearch />
      </div>

      <StatusFilterPills counts={counts} />

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
  );
}
