"use client";

import { useCallback, useEffect, useRef } from "react";
import { LogoSpinner } from "@/components/logo";
import { EmptyState } from "@/components/empty-state";
import { formatBookingTime } from "@/lib/bookings";
import type { Slot } from "@/lib/public-booking";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 44; // the project's documented touch-target minimum, not the 4px spacing scale
const VISIBLE_ROWS = 5;
const CONTAINER_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
const SPACER_HEIGHT = CONTAINER_HEIGHT / 2 - ROW_HEIGHT / 2;
const SETTLE_DEBOUNCE_MS = 150;

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.trim().replace("#", "");
  const value = Number.parseInt(clean, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// Reads the live CSS custom properties rather than hardcoding hex, so the
// lerp still resolves to the correct light/dark colour whichever mode is
// active — no raw colour literal is introduced.
function readThemeColors(): { primary: [number, number, number]; muted: [number, number, number] } {
  const styles = getComputedStyle(document.documentElement);
  const primaryHex = styles.getPropertyValue("--text-primary").trim() || "#1a1815";
  const mutedHex = styles.getPropertyValue("--text-muted").trim() || "#8a8378";
  return { primary: hexToRgb(primaryHex), muted: hexToRgb(mutedHex) };
}

function clampIndex(index: number, length: number) {
  return Math.min(Math.max(index, 0), length - 1);
}

// Single scrollable column of only the actually-bookable slots — every row is a real,
// selectable time, never a dimmed/disabled one, since a wheel has no sensible way to
// present an unselectable row the way a grid does.
export function TimeWheel({
  slots,
  value,
  onChange,
  loading,
}: {
  slots: Slot[];
  value: string | null;
  onChange: (time: string) => void;
  loading?: boolean;
}) {
  const rows = slots.filter((s) => s.available);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rafRef = useRef<number | null>(null);
  const isScrollingRef = useRef(false);
  const settleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const applyStylesOnce = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    // Read fresh every call rather than caching once — this page's dark mode is
    // applied by a script that can run after this component's first paint (or a
    // rare prefers-color-scheme change while the page is open), and a stale cached
    // value would render dark-on-dark once .dark actually lands on <html>. A single
    // getComputedStyle read on the root element is cheap; no layout is triggered.
    const { primary, muted } = readThemeColors();
    const scrollTop = container.scrollTop;

    rowsRef.current.forEach((_, i) => {
      const el = rowRefs.current[i];
      if (!el) return;
      const rowCenter = i * ROW_HEIGHT;
      const distance = Math.abs(rowCenter - scrollTop);
      const t = clamp01(distance / (CONTAINER_HEIGHT / 2));
      const [pr, pg, pb] = primary;
      const [mr, mg, mb] = muted;
      el.style.fontSize = `${lerp(20, 12, t)}px`;
      el.style.fontWeight = String(Math.round(lerp(600, 400, t)));
      el.style.opacity = String(lerp(1, 0.25, t));
      el.style.color = `rgb(${Math.round(lerp(pr, mr, t))}, ${Math.round(lerp(pg, mg, t))}, ${Math.round(lerp(pb, mb, t))})`;
      // The actual "glass magnifier" effect — the centered row grows via transform,
      // never blurs. transform doesn't affect scroll-snap geometry, so this can't
      // interfere with the snap/settle math above.
      el.style.transform = `scale(${lerp(1.16, 1, t)})`;
    });
  }, []);

  // A plain nested function (not a useCallback) so its self-reference for the
  // recursive rAF loop is an ordinary named-function-declaration recursion, not a
  // reference to a not-yet-assigned `const` across renders.
  const startTicking = useCallback(() => {
    if (rafRef.current !== null) return;
    function loop() {
      applyStylesOnce();
      if (isScrollingRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        rafRef.current = null;
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [applyStylesOnce]);

  const nearestIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container || rowsRef.current.length === 0) return 0;
    return clampIndex(Math.round(container.scrollTop / ROW_HEIGHT), rowsRef.current.length);
  }, []);

  const commit = useCallback(() => {
    const current = rowsRef.current;
    if (current.length === 0) return;
    onChange(current[nearestIndex()]!.time);
  }, [nearestIndex, onChange]);

  const handleSettle = useCallback(() => {
    isScrollingRef.current = false;
    if (settleTimeoutRef.current) {
      clearTimeout(settleTimeoutRef.current);
      settleTimeoutRef.current = null;
    }
    commit();
    applyStylesOnce();
  }, [commit, applyStylesOnce]);

  const handleScroll = useCallback(() => {
    isScrollingRef.current = true;
    startTicking();
    if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    settleTimeoutRef.current = setTimeout(handleSettle, SETTLE_DEBOUNCE_MS);
  }, [startTicking, handleSettle]);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior) => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: index * ROW_HEIGHT, behavior });
  }, []);

  // scrollend fires sooner and more reliably than the debounce where it's supported;
  // the debounce timer above stays running regardless as the fallback for browsers
  // (Safari, at the time of writing) that don't support it — committing twice is a
  // harmless no-op since the second commit resolves to the same nearest row.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !("onscrollend" in window)) return;
    container.addEventListener("scrollend", handleSettle);
    return () => container.removeEventListener("scrollend", handleSettle);
  }, [handleSettle]);

  // Re-sync scroll position whenever the fetched slot list changes (date change, or a
  // 409 re-fetch after a taken slot disappears from the list). Jumps instantly rather
  // than animating, since this reflects a data change, not a user gesture.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || rows.length === 0) return;
    const targetIndex = value ? Math.max(rows.findIndex((s) => s.time === value), 0) : 0;
    container.scrollTop = targetIndex * ROW_HEIGHT;
    applyStylesOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.map((s) => s.time).join(","), applyStylesOnce]);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (settleTimeoutRef.current) clearTimeout(settleTimeoutRef.current);
    };
  }, []);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      scrollToIndex(clampIndex(nearestIndex() + 1, rows.length), "smooth");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      scrollToIndex(clampIndex(nearestIndex() - 1, rows.length), "smooth");
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit();
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height: CONTAINER_HEIGHT }}>
        <LogoSpinner className="size-6" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height: CONTAINER_HEIGHT }}>
        <EmptyState heading="No times available" body="Try another date." />
      </div>
    );
  }

  return (
    <div className="relative" style={{ height: CONTAINER_HEIGHT }}>
      <div
        ref={containerRef}
        role="listbox"
        aria-label="Select a time"
        tabIndex={0}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        className="h-full overflow-y-scroll outline-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ scrollSnapType: "y mandatory" }}
      >
        <div style={{ height: SPACER_HEIGHT }} aria-hidden />
        {rows.map((slot, i) => (
          <button
            key={slot.time}
            type="button"
            role="option"
            aria-selected={value === slot.time}
            ref={(el) => {
              rowRefs.current[i] = el;
            }}
            onClick={() => {
              // A click is an unambiguous, explicit selection — commit it directly rather
              // than inferring intent from a scroll-settle event. scrollTo() produces no
              // native "scroll" event at all when the target position doesn't actually
              // change (a single-row wheel, or re-clicking the already-centered row), which
              // would otherwise leave commit() never firing and the CTA disabled forever.
              scrollToIndex(i, "smooth");
              onChange(slot.time);
            }}
            className="flex w-full items-center justify-center text-text-primary tabular-nums"
            style={{ height: ROW_HEIGHT, scrollSnapAlign: "center" }}
          >
            {formatBookingTime(slot.time)}
          </button>
        ))}
        <div style={{ height: SPACER_HEIGHT }} aria-hidden />
      </div>

      {/* Glass band — bright edges, near-transparent centre, saturate-only lens effect
          over whichever row currently sits there. No blur: an iPhone-style magnifier
          keeps content perfectly sharp and enlarges it (the scale() transform in
          applyStylesOnce above), it never blurs. Never intercepts scroll input. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 [backdrop-filter:saturate(1.4)] [-webkit-backdrop-filter:saturate(1.4)]",
          "supports-[not(backdrop-filter:saturate(1px))]:bg-surface-2/30"
        )}
        style={{
          top: SPACER_HEIGHT,
          height: ROW_HEIGHT,
          boxShadow: "inset 0 1px 0 0 var(--border-strong), inset 0 -1px 0 0 var(--border-strong)",
        }}
      />

      {/* Fade masks — matching whichever surface the wheel sits on: the bare page
          background on mobile (no card chrome), the card fill on desktop. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-surface-0 to-transparent sm:from-surface-2"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface-0 to-transparent sm:from-surface-2"
        aria-hidden
      />
    </div>
  );
}
