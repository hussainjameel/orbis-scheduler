import Link from "next/link";
import { List } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatBookingDate, formatBookingTime, type BookingListItem } from "@/lib/bookings";

export function RecentBookingsCard({ bookings }: { bookings: BookingListItem[] }) {
  return (
    <div className="rounded-md border border-border-default bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-medium text-text-primary">Recent bookings</h2>
        <Link href="/dashboard/bookings" className="text-sm text-text-secondary hover:text-text-primary">
          View all
        </Link>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={List}
          heading="No bookings yet"
          body="Share your booking link and they'll appear here as customers request times."
          action={<Button render={<Link href="/dashboard/share">Get your booking link</Link>} nativeButton={false} />}
        />
      ) : (
        <div className="flex flex-col">
          {bookings.map((booking) => (
            <Link
              key={booking.id}
              href={`/dashboard/bookings/${booking.id}`}
              className="flex items-center justify-between gap-3 border-t border-border-default py-3 first:border-t-0 hover:bg-surface-1"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-text-primary">{booking.customerName}</p>
                <p className="tabular text-xs text-text-secondary">
                  {formatBookingDate(booking.bookingDate)} · {formatBookingTime(booking.bookingTime)}
                </p>
              </div>
              <StatusBadge status={booking.status} className="shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
