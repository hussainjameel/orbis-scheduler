import type { ReactNode } from "react";

import { LogoMark } from "@/components/logo";
import { cn } from "@/lib/utils";

export function PublicSidebar({
  headline,
  tagline,
  maxWidth = "380px",
  children,
}: {
  headline: string;
  tagline: string;
  maxWidth?: "380px" | "560px";
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col sm:flex-row">
      {/* Brand panel — deliberate inversion within light mode.
          Background is text-primary, foreground is surface-0, so both
          flip together and contrast holds in either mode.
          Lockup sizes (size-12 / text-[42px]) are a deliberate one-off
          brand moment, outside the five-size scale by design. */}
      <aside className="bg-text-primary px-10 py-8 sm:flex sm:w-[30%] sm:min-w-[280px] sm:max-w-[420px] sm:flex-col sm:items-start sm:justify-center sm:px-14 sm:py-12">
        <div className="flex items-center gap-3">
          <LogoMark className="size-12 text-brand" />
          <span className="text-[42px] font-medium leading-none text-surface-0">
            Orbis
          </span>
        </div>
        <h2 className="mt-10 text-2xl font-medium text-surface-0">{headline}</h2>
        <p className="mt-2 text-base text-surface-0/70">{tagline}</p>
      </aside>

      {/* Form column — form itself constrained and centred */}
      <main className="flex flex-1 items-start justify-center px-6 py-10 sm:items-center sm:px-10 sm:py-12">
        <div className={cn("w-full", maxWidth === "560px" ? "max-w-[560px]" : "max-w-[380px]")}>
          {children}
        </div>
      </main>
    </div>
  );
}
