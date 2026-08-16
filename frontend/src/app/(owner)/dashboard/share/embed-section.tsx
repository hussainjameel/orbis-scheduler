"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { EmbedSnippet } from "./embed-snippet";
import { CopyButton } from "./copy-button";

// Local view state, not URL-driven — unlike the bookings screen's status
// filter pills, which mode is showing here has nothing to share/bookmark,
// it's just which snippet the owner wants to copy right now.
type Mode = "auto" | "custom";

export function EmbedSection({ origin, businessId }: { origin: string; businessId: string }) {
  const [mode, setMode] = useState<Mode>("auto");

  // Auto mode's snippet is byte-for-byte what every business already has
  // pasted into their site — no data-auto-button attribute added, so
  // nothing already deployed needs to change.
  const autoSnippet = `<script src="${origin}/widget.js" data-business-id="${businessId}"></script>`;
  const customScriptSnippet = `<script src="${origin}/widget.js" data-business-id="${businessId}" data-auto-button="false"></script>`;
  const customButtonSnippet = `<button onclick="Orbis.open()">Book now</button>`;

  return (
    <div className="rounded-md border border-border-default bg-surface-2 p-4">
      <h2 className="mb-1 text-xl font-medium text-text-primary">Embed on your website</h2>
      <p className="mb-3 text-sm text-text-secondary">
        Paste this snippet before the closing &lt;/body&gt; tag to add a booking button to your site.
      </p>

      <div className="mb-4 flex gap-2">
        {(
          [
            { value: "auto", label: "Auto button" },
            { value: "custom", label: "I'll use my own button" },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs transition-colors",
              mode === option.value
                ? "bg-text-primary text-surface-0"
                : "border border-border-strong bg-surface-2 text-text-secondary hover:bg-surface-1"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {mode === "auto" ? (
        <div className="flex flex-col gap-2">
          <EmbedSnippet snippet={autoSnippet} />
          <div className="flex justify-end">
            <CopyButton text={autoSnippet} toastMessage="Snippet copied" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Step 1 — add this to your page</p>
            <div className="flex flex-col gap-2">
              <EmbedSnippet snippet={customScriptSnippet} />
              <div className="flex justify-end">
                <CopyButton text={customScriptSnippet} toastMessage="Snippet copied" />
              </div>
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-text-primary">Step 2 — wire it to your own button</p>
            <p className="mb-2 text-sm text-text-secondary">
              Add <code className="font-mono text-xs">onclick=&quot;Orbis.open()&quot;</code> to any existing button on
              your page to make it open the same booking window — it doesn&apos;t need to look like this example.
            </p>
            <div className="flex flex-col gap-2">
              <EmbedSnippet snippet={customButtonSnippet} />
              <div className="flex justify-end">
                <CopyButton text={customButtonSnippet} toastMessage="Snippet copied" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
