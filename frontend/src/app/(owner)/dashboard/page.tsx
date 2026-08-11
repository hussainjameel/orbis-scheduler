import { apiFetch } from "@/lib/api";
import type { BookingsResponse } from "@/lib/bookings";
import type { AvailabilityResponse } from "@/lib/availability";
import type { BookingFormResponse } from "@/lib/form-builder";
import { Greeting } from "./greeting";
import { StatCards } from "./stat-cards";
import { RecentBookingsCard } from "./recent-bookings-card";
import { SetupStatusCard } from "./setup-status-card";
import { GetMoreBookingsCard } from "./get-more-bookings-card";

interface BusinessSummary {
  name: string;
  owner: { name: string };
}

export default async function DashboardPage() {
  const [{ business }, bookings, { availability }, form] = await Promise.all([
    apiFetch<{ business: BusinessSummary }>("/owner/business"),
    apiFetch<BookingsResponse>("/owner/bookings"),
    apiFetch<AvailabilityResponse>("/owner/availability"),
    apiFetch<BookingFormResponse>("/owner/form"),
  ]);

  const firstName = business.owner.name.split(" ")[0]!;
  const availabilitySet = availability.some((day) => day.isAvailable);
  const formCustomized = form.fields.length > 3;

  return (
    <div className="flex flex-col">
      <div>
        <Greeting firstName={firstName} />
        <p className="mb-6 text-sm text-text-secondary">Here&apos;s what&apos;s happening with {business.name} today.</p>
      </div>

      <div className="flex flex-col gap-4">
        <StatCards counts={bookings.counts} />

        <div className="grid grid-cols-[1.4fr_1fr] gap-4">
          <RecentBookingsCard bookings={bookings.bookings.slice(0, 5)} />
          <div className="flex flex-col gap-4">
            <GetMoreBookingsCard />
            <SetupStatusCard availabilitySet={availabilitySet} formCustomized={formCustomized} />
          </div>
        </div>
      </div>
    </div>
  );
}
