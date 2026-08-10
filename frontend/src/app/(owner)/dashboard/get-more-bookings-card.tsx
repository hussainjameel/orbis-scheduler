import Link from "next/link";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GetMoreBookingsCard() {
  return (
    <div className="rounded-md border border-border-default bg-surface-2 p-4">
      <Share2 className="size-5 text-text-secondary" strokeWidth={1.5} />
      <h2 className="mt-3 text-xl font-medium text-text-primary">Get more bookings</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Share your booking link or embed it on your website to start filling your calendar.
      </p>
      <Button render={<Link href="/dashboard/share">Share &amp; embed</Link>} nativeButton={false} className="mt-3" />
    </div>
  );
}
