"use client";

import { DayPicker, type DayButtonProps } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { bookingWindowEnd, isClosedWeekday, type WeeklyAvailabilityDay } from "@/lib/public-booking";

// react-day-picker applies modifier-driven classNames (selected/disabled/outside/custom
// modifiers) to the <td> gridcell, not the inner <button> — so styling the day text color
// via `classNames.day_button` + `modifiersClassNames` doesn't work; a directly-applied
// class on the button always wins over an inherited color from its ancestor <td>. Swapping
// in a custom DayButton (react-day-picker's own supported extension point for exactly this)
// reads `modifiers` directly instead, so the dimming/selected/disabled colors are guaranteed
// correct regardless of DOM inheritance.
function CustomDayButton({ day: _day, modifiers, className: _className, children, ...props }: DayButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "mx-auto flex size-9 items-center justify-center rounded-full text-sm transition-colors hover:bg-surface-1 disabled:pointer-events-none disabled:hover:bg-transparent",
        modifiers.selected
          ? "bg-brand font-medium text-brand-on hover:bg-brand"
          : modifiers.disabled || modifiers.closed || modifiers.outside
            ? "text-text-disabled"
            : "text-text-primary",
        modifiers.today && !modifiers.selected && "font-medium"
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Closed weekdays are dimmed only, never disabled — a customer who taps one still lands
// on the normal "no times available" wheel state instead of a dead button, so there's no
// second source of truth to keep in sync with GET /public/slots.
export function BookingCalendar({
  selected,
  onSelect,
  availability,
  bookingWindowDays,
}: {
  selected: Date | undefined;
  onSelect: (date: Date) => void;
  availability: WeeklyAvailabilityDay[];
  bookingWindowDays: number;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowEnd = bookingWindowEnd(bookingWindowDays, today);

  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={(day) => day && onSelect(day)}
      disabled={(date) => date < today || date > windowEnd}
      modifiers={{ closed: (date) => isClosedWeekday(date, availability) }}
      showOutsideDays
      className="w-full"
      classNames={{
        months: "relative w-full",
        month: "w-full",
        nav: "absolute inset-x-0 top-0 z-10 flex items-center justify-between",
        month_caption: "flex h-9 items-center justify-center text-sm font-medium text-text-primary",
        button_previous:
          "inline-flex size-8 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-1 hover:text-text-primary disabled:pointer-events-none disabled:opacity-40",
        button_next:
          "inline-flex size-8 items-center justify-center rounded-sm text-text-secondary hover:bg-surface-1 hover:text-text-primary disabled:pointer-events-none disabled:opacity-40",
        month_grid: "mt-3 w-full border-collapse",
        weekdays: "flex",
        weekday: "flex-1 pb-2 text-center text-xs font-medium text-text-muted",
        weeks: "flex flex-col gap-1",
        week: "flex w-full",
        day: "flex-1 text-center",
      }}
      components={{
        DayButton: CustomDayButton,
        Chevron: ({ orientation, className }) =>
          orientation === "left" ? (
            <ChevronLeft className={cn("size-4", className)} />
          ) : (
            <ChevronRight className={cn("size-4", className)} />
          ),
      }}
    />
  );
}
