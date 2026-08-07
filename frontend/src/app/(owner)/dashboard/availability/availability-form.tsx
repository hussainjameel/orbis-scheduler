"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
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
  const weekError = form.formState.errors.days?.message;

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

  function onInvalid() {
    toast.error("Fix the highlighted fields before saving");
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
