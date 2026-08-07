"use client";

import { Controller, type Control, type FieldErrors } from "react-hook-form";
import { Calendar, X } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DAY_NAMES,
  TIME_OPTIONS,
  SLOT_DURATION_OPTIONS,
  formatTimeLabel,
  parseTimeToMinutes,
  type AvailabilityFormValues,
} from "@/lib/availability";

const timeSelectClassName = "h-11 w-full rounded-sm border-border-strong sm:text-xs";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rejected-text">{message}</p>;
}

// Default break: the hour starting at the midpoint of the open window,
// rounded to the nearest 15 minutes and clamped inside it.
function defaultBreakRange(startTime: string, endTime: string): { breakStart: string; breakEnd: string } {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const midpoint = Math.round((startMinutes + endMinutes) / 2 / 15) * 15;
  const breakStartMinutes = Math.max(startMinutes, Math.min(midpoint, endMinutes - 15));
  const breakEndMinutes = Math.min(breakStartMinutes + 30, endMinutes);
  const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { breakStart: toTime(breakStartMinutes), breakEnd: toTime(breakEndMinutes) };
}

export function DayCard({
  index,
  control,
  errors,
}: {
  index: number;
  control: Control<AvailabilityFormValues>;
  errors: FieldErrors<AvailabilityFormValues>;
}) {
  const dayErrors = errors.days?.[index];

  return (
    <Controller
      name={`days.${index}`}
      control={control}
      render={({ field }) => {
        const day = field.value;

        return (
          <div className="overflow-hidden rounded-md border border-border-default bg-surface-2">
            <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
              <div className="flex items-center gap-2">
                <Calendar
                  className={cn("size-4", day.isAvailable ? "text-brand" : "text-text-muted")}
                  strokeWidth={1.5}
                />
                <span className="text-base font-medium text-text-primary sm:text-sm">{DAY_NAMES[index]}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted">{day.isAvailable ? "Available" : "Closed"}</span>
                <Switch
                  checked={day.isAvailable}
                  onCheckedChange={(checked) => field.onChange({ ...day, isAvailable: checked })}
                />
              </div>
            </div>

            {day.isAvailable ? (
              <div className="flex flex-col gap-3.5 p-5">
                <div className="flex items-center gap-4">
                  <span className="w-16 shrink-0 text-sm text-text-muted sm:text-xs">From</span>
                  <div className="flex-1">
                    <Select
                      value={day.startTime ?? undefined}
                      onValueChange={(value) => field.onChange({ ...day, startTime: value })}
                    >
                      <SelectTrigger className={timeSelectClassName} aria-invalid={Boolean(dayErrors?.startTime)}>
                        <SelectValue placeholder="Select a time" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={dayErrors?.startTime?.message} />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-16 shrink-0 text-sm text-text-muted sm:text-xs">To</span>
                  <div className="flex-1">
                    <Select
                      value={day.endTime ?? undefined}
                      onValueChange={(value) => field.onChange({ ...day, endTime: value })}
                    >
                      <SelectTrigger className={timeSelectClassName} aria-invalid={Boolean(dayErrors?.endTime)}>
                        <SelectValue placeholder="Select a time" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={dayErrors?.endTime?.message} />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-16 shrink-0 text-sm text-text-muted sm:text-xs">{day.breakStart ? "Break" : ""}</span>
                  <div className="flex-1">
                    {day.breakStart && day.breakEnd ? (
                      <div className="flex items-center gap-2">
                        <Select
                          value={day.breakStart}
                          onValueChange={(value) => field.onChange({ ...day, breakStart: value })}
                        >
                          <SelectTrigger
                            className={cn(timeSelectClassName, "flex-1")}
                            aria-invalid={Boolean(dayErrors?.breakEnd)}
                          >
                            <SelectValue>{formatTimeLabel(day.breakStart)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <span className="text-text-muted">–</span>
                        <Select
                          value={day.breakEnd}
                          onValueChange={(value) => field.onChange({ ...day, breakEnd: value })}
                        >
                          <SelectTrigger
                            className={cn(timeSelectClassName, "flex-1")}
                            aria-invalid={Boolean(dayErrors?.breakEnd)}
                          >
                            <SelectValue>{formatTimeLabel(day.breakEnd)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove break"
                          onClick={() => field.onChange({ ...day, breakStart: null, breakEnd: null })}
                        >
                          <X className="size-4" strokeWidth={1.5} />
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          field.onChange({
                            ...day,
                            ...defaultBreakRange(day.startTime ?? "09:00", day.endTime ?? "17:00"),
                          })
                        }
                        className="h-10 w-full rounded-sm border border-dashed border-border-strong text-sm text-text-muted transition-colors hover:bg-surface-1"
                      >
                        + Add a break
                      </button>
                    )}
                    <FieldError message={dayErrors?.breakEnd?.message} />
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="w-16 shrink-0 text-sm text-text-muted sm:text-xs">Slot</span>
                  <div className="flex-1">
                    <Select
                      value={day.slotDurationMinutes != null ? String(day.slotDurationMinutes) : undefined}
                      onValueChange={(value) => field.onChange({ ...day, slotDurationMinutes: Number(value) })}
                    >
                      <SelectTrigger
                        className={timeSelectClassName}
                        aria-invalid={Boolean(dayErrors?.slotDurationMinutes)}
                      >
                        <SelectValue placeholder="Select a duration" />
                      </SelectTrigger>
                      <SelectContent>
                        {SLOT_DURATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldError message={dayErrors?.slotDurationMinutes?.message} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center px-5 py-8">
                <p className="text-sm text-text-muted">Closed — no bookings this day</p>
              </div>
            )}
          </div>
        );
      }}
    />
  );
}
