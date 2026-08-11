"use client";

import { useCallback, useRef, useState } from "react";
import { CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { LoadingOverlay } from "@/components/loading-overlay";
import { clientFetch, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatBookingTime } from "@/lib/bookings";
import {
  buildFieldValues,
  hasAnyAvailability,
  resolveCustomerIdentity,
  toDateKey,
  validateEmailFormat,
  validateRequiredFields,
  type BookingSubmitPayload,
  type BookingSuccessResponse,
  type FieldValueMap,
  type PublicBusiness,
  type Slot,
  type SlotsResponse,
} from "@/lib/public-booking";
import { BookingCalendar } from "./booking-calendar";
import { TimeWheel } from "./time-wheel";
import { BookingSummaryCard, formatFull } from "./booking-summary-card";
import { DynamicFormFields } from "./dynamic-form-fields";
import { BookingConfirmation } from "./booking-confirmation";

// page.tsx only renders this component once business.form has been confirmed non-null
// (a business with no active form can't take bookings at all — a defensive branch
// handled one level up, alongside the 404/error states).
export function BookingPageClient({ business }: { business: PublicBusiness }) {
  const form = business.form!;
  const noAvailabilityAtAll = !hasAnyAvailability(business.availability);

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [committedTime, setCommittedTime] = useState<string | null>(null);

  const [fieldValues, setFieldValues] = useState<FieldValueMap>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<BookingSuccessResponse | null>(null);

  const timeSectionRef = useRef<HTMLDivElement | null>(null);

  const fetchSlots = useCallback(
    async (date: Date) => {
      try {
        const qs = new URLSearchParams({ businessId: business.id, date: toDateKey(date) });
        const res = await clientFetch<SlotsResponse>(`/public/slots?${qs.toString()}`);
        setSlots(res.slots);
      } catch {
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [business.id]
  );

  // Slots must re-fetch on date change — the only source of truth for which specific
  // times are bookable on a given day (the calendar's own dimming comes from the
  // weekly pattern alone, never from a per-date fetch across the visible month).
  // Triggered directly from the event handler that changes the date, not a reactive
  // effect watching selectedDate — selectedDate only ever changes here, so there's
  // nothing an effect indirection would add.
  function handleDateSelect(date: Date) {
    setSelectedDate(date);
    setCommittedTime(null);
    setSubmitError(null);
    setSlotsLoading(true);
    fetchSlots(date);
  }

  function handleFieldValueChange(fieldId: number, value: string | string[]) {
    setFieldValues((prev) => ({ ...prev, [fieldId]: value }));
    setErrors((prev) => {
      if (!prev[String(fieldId)]) return prev;
      const next = { ...prev };
      delete next[String(fieldId)];
      return next;
    });
  }

  async function handleSubmit() {
    if (!selectedDate || !committedTime) return;

    const validationErrors = {
      ...validateRequiredFields(form.fields, fieldValues),
      ...validateEmailFormat(form.fields, fieldValues),
    };
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Fix the highlighted fields before saving");
      return;
    }

    setErrors({});
    setSubmitError(null);
    setSubmitting(true);

    const identity = resolveCustomerIdentity(form.fields, fieldValues);
    const payload: BookingSubmitPayload = {
      businessId: business.id,
      formId: form.id,
      bookingDate: toDateKey(selectedDate),
      bookingTime: committedTime,
      customerName: identity.name,
      customerEmail: identity.email,
      ...(identity.phone ? { customerPhone: identity.phone } : {}),
      fieldValues: buildFieldValues(form.fields, fieldValues),
    };

    try {
      const result = await clientFetch<BookingSuccessResponse>("/public/bookings", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSubmitted(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        if (err.status === 409) {
          // The taken slot is no longer valid — clear it and re-fetch so it drops out
          // of the wheel. The date and every other field the customer already entered
          // (name/email/dynamic answers) are left completely untouched.
          setCommittedTime(null);
          setSlotsLoading(true);
          fetchSlots(selectedDate);
          timeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      } else {
        setSubmitError("Something went wrong, please try again");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setSubmitted(null);
    setSelectedDate(undefined);
    setSlots([]);
    setCommittedTime(null);
    setFieldValues({});
    setErrors({});
    setSubmitError(null);
  }

  if (submitted) {
    return (
      <BookingConfirmation
        businessName={business.name}
        booking={submitted}
        fields={form.fields}
        values={fieldValues}
        onReset={handleReset}
      />
    );
  }

  const ctaDisabled = submitting || !selectedDate || !committedTime;
  const ctaLabel =
    selectedDate && committedTime
      ? `Request booking — ${formatFull(selectedDate)}, ${formatBookingTime(committedTime)}`
      : "Request booking";

  return (
    <div className="mx-auto w-full max-w-[700px] px-6 pt-11 pb-28 sm:pb-16 xl:max-w-[820px] 2xl:max-w-[960px]">
      <div className="text-center">
        <p className="text-sm font-medium text-text-secondary">{business.name}</p>
        {business.description && (
          <p className="mx-auto mt-1 max-w-[420px] text-xs text-text-muted">{business.description}</p>
        )}
        <h1 className="mt-3 text-2xl font-medium text-text-primary">Book an appointment</h1>
      </div>

      <div className="mt-12 sm:rounded-md sm:border sm:border-border-default sm:bg-surface-2 sm:p-6">
        {noAvailabilityAtAll ? (
          <EmptyState
            icon={CalendarX}
            heading="No slots available yet"
            body={`${business.name} hasn't configured their availability yet. Check back soon.`}
          />
        ) : (
          <>
            <div className="flex flex-col gap-8 sm:grid sm:grid-cols-2 sm:gap-6">
              <div>
                <p className="mb-3 text-sm font-medium text-brand">Select a date</p>
                <BookingCalendar
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  availability={business.availability}
                  bookingWindowDays={form.bookingWindowDays}
                />
              </div>
              <div ref={timeSectionRef}>
                <p className="mb-3 text-sm font-medium text-brand">Select a time</p>
                {selectedDate ? (
                  <TimeWheel slots={slots} value={committedTime} onChange={setCommittedTime} loading={slotsLoading} />
                ) : (
                  <div className="flex items-center justify-center" style={{ height: 220 }}>
                    <EmptyState heading="Pick a date" body="Choose a date to see available times." />
                  </div>
                )}
              </div>
            </div>

            {selectedDate && committedTime && (
              <div className="mt-6">
                <BookingSummaryCard date={selectedDate} time={committedTime} />
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 sm:rounded-md sm:border sm:border-border-default sm:bg-surface-2 sm:p-6">
        <p className="mb-3 text-sm font-medium text-brand">Your details</p>
        <DynamicFormFields fields={form.fields} values={fieldValues} onValueChange={handleFieldValueChange} errors={errors} />

        {submitError && (
          <p role="alert" className="mt-6 border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
            {submitError}
          </p>
        )}

        <div className="mt-8 hidden sm:flex sm:justify-center">
          <Button onClick={handleSubmit} disabled={ctaDisabled} className="h-10 rounded-full px-8">
            Request booking
          </Button>
        </div>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-20 flex justify-center border-t border-border-default bg-surface-0/95 px-4 pt-4 backdrop-blur-sm sm:hidden"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Button onClick={handleSubmit} disabled={ctaDisabled} className="h-11 max-w-full rounded-full px-8">
          <span className="truncate">{ctaLabel}</span>
        </Button>
      </div>

      {submitting && <LoadingOverlay />}
    </div>
  );
}
