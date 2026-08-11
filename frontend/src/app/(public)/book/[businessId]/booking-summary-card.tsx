import { Calendar, Clock, Check } from "lucide-react";
import { formatBookingTime } from "@/lib/bookings";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatFull(date: Date): string {
  return `${WEEKDAYS[(date.getDay() + 6) % 7]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// Ticket-stub style: a thin brand accent bar, two labeled sub-fields split by a
// hairline, a small "locked in" checkmark badge — deliberately not a filled
// orange/peach block (an earlier draft, rejected).
export function BookingSummaryCard({ date, time }: { date: Date; time: string }) {
  return (
    <div className="relative flex overflow-hidden rounded-md border border-border-default bg-surface-2">
      <div className="w-1 shrink-0 bg-brand" aria-hidden />
      <div className="flex flex-1 items-center">
        <div className="flex flex-1 items-center gap-2.5 px-4 py-3">
          <Calendar className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
          <div>
            <p className="text-xs text-text-muted">Date</p>
            <p className="text-sm font-medium text-text-primary">{formatFull(date)}</p>
          </div>
        </div>
        <div className="h-10 w-px bg-border-default" aria-hidden />
        <div className="flex flex-1 items-center gap-2.5 px-4 py-3">
          <Clock className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
          <div>
            <p className="text-xs text-text-muted">Time</p>
            <p className="text-sm font-medium text-text-primary">{formatBookingTime(time)}</p>
          </div>
        </div>
      </div>
      <div className="flex items-center pr-4">
        <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-approved">
          <Check className="size-3 text-approved-text" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}
