"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className, iconOnly }: { className?: string; iconOnly?: boolean }) {
  const { isDark, toggle } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-1 hover:text-text-primary",
        className
      )}
    >
      {isDark ? (
        <Moon className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
      ) : (
        <Sun className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
      )}
      {!iconOnly && <span>Theme</span>}
    </button>
  );
}
