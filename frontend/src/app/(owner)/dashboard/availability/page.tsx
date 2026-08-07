import { apiFetch } from "@/lib/api";
import { fillWeek, type AvailabilityResponse } from "@/lib/availability";
import { AvailabilityForm } from "./availability-form";

export default async function AvailabilityPage() {
  const { availability } = await apiFetch<AvailabilityResponse>("/owner/availability");

  return (
    <div className="flex flex-col">
      <h1 className="text-2xl font-medium text-text-primary">Availability</h1>
      <p className="mb-6 text-sm text-text-secondary">
        Set the hours customers can book each day. Slots are calculated from this schedule automatically.
      </p>

      <AvailabilityForm initialDays={fillWeek(availability)} />
    </div>
  );
}
