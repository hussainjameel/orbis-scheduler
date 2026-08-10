import { apiFetch } from "@/lib/api";
import type { BookingFormResponse } from "@/lib/form-builder";
import { TitleDescriptionForm } from "./title-description-form";
import { FormBuilderClient } from "./form-builder-client";

export default async function FormBuilderPage() {
  const form = await apiFetch<BookingFormResponse>("/owner/form");

  return (
    <div className="flex flex-col">
      <div>
        <h1 className="mb-1 text-2xl font-medium text-text-primary">Booking form</h1>
        <p className="mb-6 text-sm text-text-secondary">
          Customize the fields customers fill out when they book with you.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        <TitleDescriptionForm initialTitle={form.title} initialDescription={form.description} />

        <FormBuilderClient initialFields={form.fields} />
      </div>
    </div>
  );
}
