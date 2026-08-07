import { z } from "zod";

export const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export interface AvailabilityDay {
  dayOfWeek: number;
  isAvailable: boolean;
  startTime: string | null;
  endTime: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  slotDurationMinutes: number | null;
}

export interface AvailabilityResponse {
  availability: AvailabilityDay[];
}

const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
}

export function formatTimeLabel(time: string): string {
  const totalMinutes = parseTimeToMinutes(time);
  const hours24 = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const period = hours24 >= 12 ? "PM" : "AM";
  const hour12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

// 15-minute increments spanning a full day, 12:00 AM to 11:45 PM.
export const TIME_OPTIONS: { value: string; label: string }[] = Array.from({ length: 96 }, (_, i) => {
  const totalMinutes = i * 15;
  const value = `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  return { value, label: formatTimeLabel(value) };
});

export const SLOT_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120].map((minutes) => ({
  value: minutes,
  label: `${minutes} min`,
}));

// Rules aren't created until the owner saves at least once, so a brand-new
// business's GET response can have fewer than 7 rows. Missing days default
// to closed rather than inventing a schedule the owner never set.
export function buildDefaultDay(dayOfWeek: number): AvailabilityDay {
  return {
    dayOfWeek,
    isAvailable: false,
    startTime: "09:00",
    endTime: "17:00",
    breakStart: null,
    breakEnd: null,
    slotDurationMinutes: 30,
  };
}

export function fillWeek(availability: AvailabilityDay[]): AvailabilityDay[] {
  const byDay = new Map(availability.map((day) => [day.dayOfWeek, day]));
  return Array.from({ length: 7 }, (_, dayOfWeek) => byDay.get(dayOfWeek) ?? buildDefaultDay(dayOfWeek));
}

const availabilityDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  isAvailable: z.boolean(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  breakStart: z.string().nullable(),
  breakEnd: z.string().nullable(),
  slotDurationMinutes: z.number().int().positive().nullable(),
});

// Mirrors backend/src/routes/owner.ts's PUT /owner/availability validation
// (and UC7's alternate flows A1-A3) so obvious errors round-trip on the
// client instead of hitting the server first (frontend spec decision 4).
const daysSchema = z
  .array(availabilityDaySchema)
  .length(7)
  .superRefine((days, ctx) => {
    days.forEach((day, index) => {
      if (!day.isAvailable) return;

      if (!day.startTime || !TIME_FORMAT.test(day.startTime)) {
        ctx.addIssue({ code: "custom", message: "Start time is required", path: [index, "startTime"] });
      }
      if (!day.endTime || !TIME_FORMAT.test(day.endTime)) {
        ctx.addIssue({ code: "custom", message: "End time is required", path: [index, "endTime"] });
      }
      if (!day.startTime || !day.endTime) return;

      const startMinutes = parseTimeToMinutes(day.startTime);
      const endMinutes = parseTimeToMinutes(day.endTime);

      if (endMinutes <= startMinutes) {
        ctx.addIssue({ code: "custom", message: "End time must be after start time", path: [index, "endTime"] });
        return;
      }

      let breakMinutes = 0;
      if (day.breakStart || day.breakEnd) {
        if (!day.breakStart || !day.breakEnd) {
          ctx.addIssue({
            code: "custom",
            message: "Break start and end must both be set",
            path: [index, "breakEnd"],
          });
        } else {
          const breakStartMinutes = parseTimeToMinutes(day.breakStart);
          const breakEndMinutes = parseTimeToMinutes(day.breakEnd);

          if (breakEndMinutes <= breakStartMinutes) {
            ctx.addIssue({ code: "custom", message: "Break end must be after break start", path: [index, "breakEnd"] });
          } else if (breakStartMinutes < startMinutes || breakEndMinutes > endMinutes) {
            ctx.addIssue({
              code: "custom",
              message: "Break must fall within start and end time",
              path: [index, "breakEnd"],
            });
          } else {
            breakMinutes = breakEndMinutes - breakStartMinutes;
          }
        }
      }

      if (!day.slotDurationMinutes) {
        ctx.addIssue({ code: "custom", message: "Slot duration is required", path: [index, "slotDurationMinutes"] });
        return;
      }

      const availableMinutes = endMinutes - startMinutes - breakMinutes;
      if (Math.floor(availableMinutes / day.slotDurationMinutes) < 1) {
        ctx.addIssue({
          code: "custom",
          message: `A ${day.slotDurationMinutes} min booking won't fit in your ${day.startTime}-${day.endTime} window for ${DAY_NAMES[index]}. Either extend the day or shorten the duration.`,
          path: [index, "slotDurationMinutes"],
        });
      }
    });
  })
  .refine((days) => days.some((day) => day.isAvailable), {
    message: "You must have at least one open day for customers to book.",
  });

export const availabilityFormSchema = z.object({ days: daysSchema });

export type AvailabilityFormValues = z.infer<typeof availabilityFormSchema>;
