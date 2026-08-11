import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  BOOKING_STATUSES,
  formatBookingDate,
  formatBookingTime,
  formatRelativeTime,
  type BookingDetail,
  type BookingStatus,
} from "@/lib/bookings";
import { StatusBadge } from "@/components/status-badge";
import { BookingActions } from "./booking-actions";

const VALID_STATUSES = BOOKING_STATUSES.map((s) => s.value);

// Name/Email/Phone are the default fields every booking form is created
// with (backend/src/routes/auth.ts:92-94) — already shown via
// customerName/customerEmail/customerPhone in the Customer card above, so
// they'd otherwise appear a second time here as ordinary form answers.
const DEFAULT_FIELD_LABELS = new Set(["Name", "Email", "Phone"]);

export default async function BookingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  // Which status filter to return to after approve/reject/cancel — carried
  // through as ?from= on the link from the list page (see bookings/page.tsx).
  const returnStatus: BookingStatus | "all" =
    sp.from === "all"
      ? "all"
      : VALID_STATUSES.includes(sp.from as BookingStatus)
        ? (sp.from as BookingStatus)
        : "pending";

  let booking: BookingDetail;
  try {
    booking = await apiFetch<BookingDetail>(`/owner/bookings/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const customFieldValues = booking.fieldValues.filter((fv) => !DEFAULT_FIELD_LABELS.has(fv.label));

  return (
    <div className="flex flex-col">
      <Link href="/dashboard/bookings" className="mb-5 flex items-center gap-1.5 text-sm text-text-secondary">
        <ChevronLeft className="size-4" />
        Back to bookings
      </Link>

      <div className="mb-6 flex items-center gap-2.5">
        <h1 className="text-2xl font-medium text-text-primary">{booking.customerName}</h1>
        <StatusBadge status={booking.status} />
      </div>

      <div className="mb-3 rounded-md border border-border-default bg-surface-2 p-4">
        <p className="mb-3 text-sm text-text-secondary">Customer</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="mb-0.5 text-xs text-text-muted">Name</p>
            <p className="text-base text-text-primary">{booking.customerName}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs text-text-muted">Email</p>
            <p className="text-base text-text-primary">{booking.customerEmail}</p>
          </div>
          {booking.customerPhone && (
            <div>
              <p className="mb-0.5 text-xs text-text-muted">Phone</p>
              <p className="text-base text-text-primary">{booking.customerPhone}</p>
            </div>
          )}
          <div>
            <p className="mb-0.5 text-xs text-text-muted">Requested</p>
            <p className="text-base text-text-primary">{formatRelativeTime(booking.createdAt)}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs text-text-muted">Date and time</p>
            <p className="text-base text-text-primary">
              {formatBookingDate(booking.bookingDate)} · {formatBookingTime(booking.bookingTime)}
            </p>
          </div>
        </div>
      </div>

      {customFieldValues.length > 0 && (
        <div className="mb-3 rounded-md border border-border-default bg-surface-2 p-4">
          <p className="mb-3 text-sm text-text-secondary">Submitted answers</p>
          {customFieldValues.map((fv, index) => (
            <div
              key={`${fv.label}-${index}`}
              className={cn("py-3 first:pt-0 last:pb-0", index > 0 && "border-t border-border-default")}
            >
              <p className="text-xs text-text-muted">{fv.label}</p>
              {(fv.fieldType === "text" || fv.fieldType === "textarea") && (
                <p className="mt-1 text-base leading-relaxed text-text-primary">{fv.value}</p>
              )}
              {(fv.fieldType === "dropdown" || fv.fieldType === "radio") && (
                <span className="mt-1 inline-block rounded-full border border-border-default bg-surface-1 px-2.5 py-1 text-sm text-text-primary">
                  {fv.value}
                </span>
              )}
              {fv.fieldType === "checkbox" && (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {(fv.value ?? "")
                    .split(", ")
                    .filter(Boolean)
                    .map((option) => (
                      <span
                        key={option}
                        className="inline-block rounded-full border border-border-default bg-surface-1 px-2.5 py-1 text-sm text-text-primary"
                      >
                        {option}
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <BookingActions
        bookingId={booking.id}
        status={booking.status}
        initialOwnerNotes={booking.ownerNotes}
        returnStatus={returnStatus}
      />
    </div>
  );
}
