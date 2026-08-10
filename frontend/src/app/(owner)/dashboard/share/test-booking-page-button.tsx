"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientFetch } from "@/lib/api-client";
import type { AvailabilityResponse } from "@/lib/availability";

export function TestBookingPageButton({ bookingUrl }: { bookingUrl: string }) {
  const [checking, setChecking] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  async function handleClick() {
    setChecking(true);
    try {
      const { availability } = await clientFetch<AvailabilityResponse>("/owner/availability");
      if (availability.some((day) => day.isAvailable)) {
        window.open(bookingUrl, "_blank");
      } else {
        setShowBanner(true);
      }
    } catch {
      // A failed check shouldn't block trying the page directly — this is a
      // helper check, not a gate, so fall back to opening it either way.
      window.open(bookingUrl, "_blank");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <Button type="button" variant="outline" onClick={handleClick} disabled={checking}>
        <ExternalLink className="size-4" strokeWidth={1.5} />
        Test booking page
      </Button>

      {showBanner && (
        <div className="flex w-full max-w-sm items-start justify-between gap-3 rounded-sm border border-border-default bg-surface-1 px-4 py-3">
          <div>
            <p className="text-sm text-text-primary">This business hasn&apos;t set their availability yet.</p>
            <Link
              href="/dashboard/availability"
              className="mt-1 inline-block text-sm text-brand underline underline-offset-2 hover:text-brand/80"
            >
              Go to availability
            </Link>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setShowBanner(false)}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>
      )}
    </div>
  );
}
