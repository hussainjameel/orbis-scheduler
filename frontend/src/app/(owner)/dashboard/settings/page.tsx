import { apiFetch } from "@/lib/api";
import { getOrigin } from "@/lib/origin";
import { SettingsForm } from "./settings-form";

interface BusinessProfile {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
}

export default async function SettingsPage() {
  const [{ business }, origin] = await Promise.all([
    apiFetch<{ business: BusinessProfile }>("/owner/business"),
    getOrigin(),
  ]);

  // Same UUID-based URL as Share & Embed's Section A (business.id, not
  // slug) — kept in sync via the shared getOrigin() helper rather than a
  // second implementation.
  const bookingUrl = `${origin}/book/${business.id}`;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <h1 className="mb-1 text-2xl font-medium text-text-primary">Settings</h1>
      <p className="mb-6 text-sm text-text-secondary">Manage your business profile and public booking details.</p>

      <div className="rounded-md border border-border-default bg-surface-2 p-6">
        <SettingsForm
          name={business.name}
          bookingUrl={bookingUrl}
          initialDescription={business.description}
          initialPhone={business.phone}
          initialContactEmail={business.contactEmail}
          initialWebsiteUrl={business.websiteUrl}
        />
      </div>
    </div>
  );
}
