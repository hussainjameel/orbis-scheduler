import Link from "next/link";
import { LogoAnimated } from "@/components/logo";
import { ThemeScript } from "@/components/theme-script";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type DayVariant = "filled" | "disabled" | "selected";

// How far ahead of today the mock "selected" slot sits. If today + this offset
// crosses into next month, the whole card displays that next month instead —
// see buildCalendarDays's caller below, which always lays out the month the
// selected date actually falls in.
const DAYS_AHEAD = 5;

// Real, Monday-first grid for the given month (0-indexed, JS Date convention),
// with correct leading/trailing days pulled from the adjacent months. Weekends
// (real day-of-week, not row position) get the same "disabled" treatment as
// adjacent-month spillover days; the one matching `selectedDay` is "selected"
// regardless of what it would otherwise be.
function buildCalendarDays(
  year: number,
  month: number,
  selectedDay: number
): { day: number; variant: DayVariant }[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  // JS getDay() is Sunday-first (0-6); shift to Monday-first (0=Mon..6=Sun).
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;

  const cells: { day: number; variant: DayVariant }[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, variant: "disabled" });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isWeekend = [0, 6].includes(new Date(year, month, day).getDay());
    cells.push({
      day,
      variant:
        day === selectedDay ? "selected" : isWeekend ? "disabled" : "filled",
    });
  }

  const trailing = (7 - (cells.length % 7)) % 7;
  for (let day = 1; day <= trailing; day++) {
    cells.push({ day, variant: "disabled" });
  }

  return cells;
}

const SLOTS: { time: string; expanded?: boolean }[] = [
  { time: "09:00" },
  { time: "09:30" },
  { time: "10:00", expanded: true },
  { time: "11:00" },
  { time: "11:30" },
];

const ROW_DELAYS_MS = [150, 280, 410, 540, 670];

// Forces per-request rendering rather than a build-time static snapshot — this page
// has no other dynamic dependency, so without this Next.js would prerender it once and
// freeze "today" at deploy time, silently reintroducing the stale-date bug this fixes.
export const dynamic = "force-dynamic";

// Hero only — further landing page sections come later. The brand colour used
// decoratively here (blob, dots, glass surfaces) and the off-scale, title-case heading
// are a deliberate, scoped exception to the design system's "one brand colour, one
// purpose" / five-size-scale / sentence-case rules, same precedent as the auth panel
// lockup. The calendar and slot picker are a stylised mock, not a live component.
export default function LandingPage() {
  const today = new Date();
  const selectedDate = new Date(today);
  selectedDate.setDate(today.getDate() + DAYS_AHEAD);

  const displayYear = selectedDate.getFullYear();
  const displayMonth = selectedDate.getMonth();
  const selectedDay = selectedDate.getDate();

  const calendarDays = buildCalendarDays(displayYear, displayMonth, selectedDay);
  const headerLabel = `${MONTH_NAMES[displayMonth]} ${displayYear}`;
  const slotLabel = `${WEEKDAY_SHORT[selectedDate.getDay()]}, ${selectedDay} ${MONTH_SHORT[displayMonth]}`;

  return (
    <div className="relative min-h-screen overflow-hidden bg-surface-0">
      <ThemeScript />

      {/* Background blob — independent of the text block entirely (not nested
          inside it, not sized from it), so resizing/repositioning it never moves
          the heading, paragraph, or button. Anchored to the page's own left edge
          via a negative left offset roughly half its own width, so about half the
          shape sits off-screen and half shows — big enough to cover most of the
          left side of the viewport. The outer div handles static position
          (including vertical centering via top-1/2 + translate), the inner div
          carries the morph animation's own transform, so the two don't collide on
          the same `transform` property. Light mode uses a clearly-visible
          saturated brand wash; dark mode is unchanged. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-[-250px] z-0 -translate-y-1/2 lg:left-[-450px]"
      >
        <div className="h-[460px] w-[500px] animate-[orbis-blob-morph_24s_ease-in-out_infinite] bg-gradient-to-br from-brand/[0.22] to-brand/[0.05] dark:bg-none dark:bg-brand/[0.06] lg:h-[820px] lg:w-[900px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <nav className="flex items-center justify-between px-5 py-4 sm:px-9 sm:py-5">
          <span className="inline-flex items-center gap-2">
            <LogoAnimated className="size-6 text-brand" />
            <span className="text-xl font-medium tracking-tight text-text-primary">
              Orbis
            </span>
          </span>

          <div className="flex items-center gap-6">
            <ThemeToggle
              iconOnly
              className="size-[30px] shrink-0 justify-center rounded-full border border-border-default p-0"
            />
            <Link href="/login" className="text-sm text-text-secondary">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-full border border-brand/[0.5] bg-brand/[0.13] px-4 py-1.5 text-sm font-medium text-[#C2410C] dark:border-brand/[0.42] dark:bg-brand/[0.14] dark:text-brand"
            >
              Register
            </Link>
          </div>
        </nav>

        <div className="flex flex-1 items-center">
          <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-12 px-8 py-6 lg:py-10 lg:px-12">
            {/* Left column — content block is centred within the column via
                justify-center on the flex column, while its own text stays
                left-aligned. The blob behind it lives at the page root now, not
                nested here — see above. */}
            <div className="flex min-w-[280px] flex-1 justify-center">
              <div className="w-fit">
                <h1 className="max-w-[400px] text-[32px] font-medium leading-[1.08] tracking-[-0.8px] text-text-primary lg:max-w-[500px] lg:text-[44px] lg:tracking-[-1.1px]">
                  Stop Taking Bookings
                  <br />
                  Over The Phone
                </h1>
                <p className="mt-4 mb-7 max-w-[340px] text-base leading-relaxed text-text-secondary">
                  Orbis gives small service businesses one link customers can
                  book from, and hours you set once.
                </p>

                <Link
                  href="/register"
                  className="relative inline-flex min-h-11 items-center justify-center overflow-hidden rounded-full border border-brand/[0.55] bg-brand/[0.16] px-7 py-3 text-base font-medium text-[#C2410C] dark:border-brand/[0.45] dark:text-brand"
                >
                  <span className="relative z-10">Get started</span>
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0 left-0 w-[36%] animate-[orbis-sheen_3.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.55] to-transparent dark:via-white/[0.22]"
                  />
                </Link>
              </div>
            </div>

            {/* Right column — calendar + slot picker card. Hidden entirely below
                lg: a 7-column calendar plus a slot column needs more horizontal
                room than it fits legibly, so it's not shrunk or reflowed, just not
                shown until there's space for it. */}
            <div className="hidden min-w-[340px] flex-1 lg:block">
              <div className="relative mx-auto w-fit">
                {/* Dotted texture panel — anchored to the card's own box (this
                    wrapper shrink-wraps to the card via w-fit), lower-right,
                    partially behind it. Hidden below lg along with the card. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-3 -bottom-3 z-0 hidden h-[150px] w-[58px] bg-[radial-gradient(circle,color-mix(in_srgb,var(--brand)_22%,transparent)_1.4px,transparent_1.4px)] bg-[length:14px_14px] lg:block"
                />

                <div className="relative z-10 flex max-w-[520px] flex-nowrap gap-[22px] rounded-[14px] bg-surface-2 p-[22px] shadow-[0_32px_64px_-24px_color-mix(in_srgb,var(--brand)_25%,transparent)] ring-1 ring-border-default animate-[orbis-card-float_7s_ease-in-out_infinite]">
                  {/* Calendar — fixed width so the 7 columns stay compact */}
                  <div className="w-[250px] shrink-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text-primary">
                        {headerLabel}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>‹</span>
                        <span>›</span>
                      </div>
                    </div>

                    {/* One grid for both the weekday-initial header and the day
                        cells, so the columns are guaranteed to line up. */}
                    <div className="mt-3 grid grid-cols-7 items-center justify-items-center gap-0.5">
                      {WEEKDAY_LETTERS.map((letter, i) => (
                        <span
                          key={`weekday-${i}`}
                          className="text-[9px] text-text-muted"
                        >
                          {letter}
                        </span>
                      ))}
                      {calendarDays.map((cell, i) => (
                        <span
                          key={i}
                          className={cn(
                            "flex size-[29px] items-center justify-center rounded-full text-xs",
                            cell.variant === "filled" &&
                              "bg-surface-0 text-text-primary",
                            cell.variant === "disabled" &&
                              "text-text-disabled",
                            cell.variant === "selected" &&
                              "bg-brand font-medium text-white"
                          )}
                        >
                          {cell.day}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="w-px shrink-0 bg-border-default" />

                  {/* Slot column */}
                  <div className="w-[132px] shrink-0">
                    <p className="mb-3 text-center text-xs font-medium text-text-primary">
                      {slotLabel}
                    </p>
                    <div className="flex flex-col gap-2">
                      {SLOTS.map((slot, i) => (
                        <div
                          key={slot.time}
                          style={{ animationDelay: `${ROW_DELAYS_MS[i]}ms` }}
                          className="animate-[orbis-row-in_450ms_ease-out_backwards]"
                        >
                          {slot.expanded ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-text-primary">
                                {slot.time}
                              </span>
                              <span className="flex-1 rounded-full bg-brand py-2.5 text-center text-[11px] font-medium text-white">
                                Confirm
                              </span>
                            </div>
                          ) : (
                            <span className="block rounded-full border border-brand/[0.4] bg-surface-2 py-2.5 text-center text-sm text-brand">
                              {slot.time}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
