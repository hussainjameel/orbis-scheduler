import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBookingDate, formatBookingTime } from "@/lib/bookings";
import type { FormField } from "@/lib/form-builder";
import type { BookingSuccessResponse, FieldValueMap } from "@/lib/public-booking";

// Mirrors register-form.tsx's existing checkmark-circle confirmation pattern, and reuses
// the exact submitted-answer rendering already built for the owner booking-detail screen
// (bookings/[id]/page.tsx) — text/textarea plain, dropdown/radio single pill, checkbox
// multi-pill. Every field (including whichever ones happen to be Name/Email/Phone) is
// rendered the same generic way, in the order the business defined — no special-casing.
export function BookingConfirmation({
  businessName,
  booking,
  fields,
  values,
  onReset,
}: {
  businessName: string;
  booking: BookingSuccessResponse;
  fields: FormField[];
  values: FieldValueMap;
  onReset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[420px] py-11 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-approved">
        <Check className="size-6 text-approved-text" />
      </div>
      <h1 className="mt-4 text-2xl font-medium text-text-primary">Your booking request has been sent!</h1>
      <p className="mt-2 text-sm text-text-secondary">{businessName} will confirm shortly.</p>

      <div className="mt-6 rounded-md border border-border-default bg-surface-2 p-4 text-left">
        <div className="flex items-center justify-between border-b border-border-default pb-3">
          <span className="text-xs text-text-muted">Booking reference</span>
          <span className="text-sm font-medium text-text-primary">#{booking.id}</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-muted">Date</p>
            <p className="text-sm text-text-primary">{formatBookingDate(booking.bookingDate)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Time</p>
            <p className="text-sm text-text-primary">{formatBookingTime(booking.bookingTime)}</p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-md border border-border-default bg-surface-2 p-4 text-left">
        <p className="mb-3 text-sm text-text-secondary">Your details</p>
        <div className="flex flex-col gap-3">
          {fields.map((field) => {
            const raw = values[field.id];
            const value = Array.isArray(raw) ? raw : raw ? [raw] : [];
            if (value.length === 0) return null;
            return (
              <div key={field.id}>
                <p className="text-xs text-text-muted">{field.label}</p>
                {field.fieldType === "text" || field.fieldType === "textarea" ? (
                  <p className="mt-0.5 text-sm text-text-primary">{value[0]}</p>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {value.map((v) => (
                      <span
                        key={v}
                        className="rounded-full border border-border-default bg-surface-1 px-2.5 py-1 text-xs text-text-primary"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Button onClick={onReset} className="mt-6 h-10 rounded-full px-8">
        Book another time
      </Button>
    </div>
  );
}
