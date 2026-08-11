import { cn } from "@/lib/utils";

/**
 * The mark on its own. Uses currentColor, so colour comes from the
 * parent — apply text-brand for orange, text-surface-0 on dark panels.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      role="img"
      aria-label="Orbis"
      className={cn("size-6", className)}
    >
      <path d="M 16 16 L 22.5 4.74 A 13 13 0 0 1 9.5 27.26 Z" />
    </svg>
  );
}

/**
 * Mark plus wordmark, horizontal. The mark takes the brand colour; the
 * wordmark inherits from the parent so it works on light and dark.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark className="size-5 text-brand" />
      <span className="text-xl font-medium tracking-tight">Orbis</span>
    </span>
  );
}

/**
 * Cross-fading version of the mark for decorative use (landing page navbar) — the
 * same two halves as LogoSpinner, but a slow, smooth 1.8s cross-fade rather than the
 * spinner's 800ms steps(1) snap. Deliberately separate keyframes: the spinner's snap
 * means "work in progress," which doesn't apply here.
 */
export function LogoAnimated({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      role="img"
      aria-label="Orbis"
      className={cn("size-6", className)}
    >
      <path
        className="animate-[orbis-fade-a_1.8s_ease-in-out_infinite]"
        d="M 16 16 L 22.5 4.74 A 13 13 0 0 1 9.5 27.26 Z"
      />
      <path
        className="animate-[orbis-fade-b_1.8s_ease-in-out_infinite]"
        d="M 16 16 L 9.5 27.26 A 13 13 0 0 1 22.5 4.74 Z"
      />
    </svg>
  );
}

/**
 * Loading indicator. The two halves of the mark alternate, so it reads as
 * one shape turning rather than a fade. Same path drawn twice with the arc
 * reversed; the animations are offset by half a cycle.
 *
 * Only use where something is genuinely in flight — it must stop when the
 * thing it indicates finishes. Reduced-motion is honoured globally by the
 * base layer, which drops the animation to zero.
 */
export function LogoSpinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="currentColor"
      role="status"
      aria-label="Loading"
      className={cn("size-6 text-brand", className)}
    >
      <path
        className="animate-[orbis-half-a_800ms_steps(1)_infinite]"
        d="M 16 16 L 22.5 4.74 A 13 13 0 0 1 9.5 27.26 Z"
      />
      <path
        className="animate-[orbis-half-b_800ms_steps(1)_infinite]"
        d="M 16 16 L 9.5 27.26 A 13 13 0 0 1 22.5 4.74 Z"
      />
    </svg>
  );
}
