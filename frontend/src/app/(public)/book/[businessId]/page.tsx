import { Ban } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import type { PublicBusiness } from "@/lib/public-booking";
import { BookingPageClient } from "./booking-page-client";
import { ThemeScript } from "./theme-script";

// The backend deliberately returns an identical 404 for a nonexistent business, a
// pending approval, a rejected one, and a suspended one (tenant-enumeration
// prevention — see CLAUDE.md) — there's no signal here to show three different
// messages the way UC1's alternate flows imply, so this is the one state for all four.
function BusinessUnavailable() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <ThemeScript />
      <EmptyState icon={Ban} heading="Business not found" body="This booking link may be incorrect or no longer active." />
    </div>
  );
}

export default async function PublicBookingPage({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;

  let business: PublicBusiness;
  try {
    const res = await apiFetch<{ business: PublicBusiness }>(`/public/businesses/${businessId}`);
    business = res.business;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return <BusinessUnavailable />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <ThemeScript />
        <ErrorState heading="Something went wrong" body="Couldn't load this booking page. Please try again." />
      </div>
    );
  }

  // Defensive only — registration always seeds a default form, so a business with
  // none is not a real reachable state, just a null-safety branch.
  if (!business.form) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <ThemeScript />
        <EmptyState icon={Ban} heading="Booking form not available" body="This business hasn't set up a booking form yet." />
      </div>
    );
  }

  return (
    <>
      <ThemeScript />
      <BookingPageClient business={business} />
    </>
  );
}
