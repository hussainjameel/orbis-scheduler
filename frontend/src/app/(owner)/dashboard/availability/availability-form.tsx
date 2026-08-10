"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { clientFetch, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { availabilityFormSchema, type AvailabilityDay, type AvailabilityFormValues } from "@/lib/availability";
import { DayCard } from "./day-card";

export function AvailabilityForm({ initialDays }: { initialDays: AvailabilityDay[] }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useForm<AvailabilityFormValues>({
    resolver: zodResolver(availabilityFormSchema),
    // Passing fresh server data through `values` (rather than `defaultValues`
    // + a manual reset) is what lets router.refresh() after a successful
    // save resync this form without hand-patching local state (decision 1).
    values: { days: initialDays },
    resetOptions: { keepDirtyValues: false },
  });

  const { fields } = useFieldArray({ control: form.control, name: "days" });
  // useFieldArray + a whole-array zod .refine() puts the message at
  // `.root`, not directly on `.days` — confirmed against the actual
  // runtime error shape, not assumed.
  const weekError = form.formState.errors.days?.root?.message;

  async function onSubmit(values: AvailabilityFormValues) {
    setSubmitError(null);
    setSubmitting(true);
    try {
      // API requires the complete week every time, as a bare array (not
      // wrapped like the GET response).
      await clientFetch("/owner/availability", {
        method: "PUT",
        body: JSON.stringify(values.days),
      });
      toast.success("Your availability has been updated");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function onInvalid(errors: FieldErrors<AvailabilityFormValues>) {
    // Per-field errors (end-before-start, break outside window, etc.) are
    // array entries on `errors.days` and DO get a rejected border on the
    // specific field — the toast is accurate there. The zero-days-open
    // rule is form-level: nothing turns red, so the same toast would be
    // misleading. That case is covered by the `weekError` banner above
    // instead, using the schema's own message rather than new copy.
    const hasFieldErrors = Array.isArray(errors.days) && errors.days.some((day) => day && Object.keys(day).length > 0);
    if (hasFieldErrors) {
      toast.error("Fix the highlighted fields before saving");
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex flex-col">
      {submitting && <LoadingOverlay />}

      {weekError && (
        <p role="alert" className="mb-5 border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
          {weekError}
        </p>
      )}

      {submitError && (
        <p role="alert" className="mb-5 border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
          {submitError}
        </p>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {fields.map((field, index) => (
          <DayCard key={field.id} index={index} control={form.control} errors={form.formState.errors} />
        ))}
      </div>

      <div className="mt-6 flex justify-end">
        <Button type="submit" disabled={submitting}>
          Save availability
        </Button>
      </div>
    </form>
  );
}
