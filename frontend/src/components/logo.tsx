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
