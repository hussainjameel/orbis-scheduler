"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Pill styling matches the established hand-rolled pattern in
// bookings/status-filter-pills.tsx — no shadcn Badge/pill component exists
// in this project.
const pillClassName = "flex items-center gap-1.5 rounded-full border border-border-strong bg-surface-2 px-2.5 py-1 text-xs text-text-secondary";

export function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (options: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  function commit() {
    const value = draft.trim();
    if (value.length > 0 && !options.includes(value)) {
      onChange([...options, value]);
    }
    setDraft("");
    setAdding(false);
  }

  function remove(index: number) {
    onChange(options.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {options.map((option, index) => (
        <span key={`${option}-${index}`} className={pillClassName}>
          {option}
          <button
            type="button"
            aria-label={`Remove ${option}`}
            onClick={() => remove(index)}
            className="text-text-muted hover:text-text-primary"
          >
            <X className="size-3" strokeWidth={1.5} />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft("");
              setAdding(false);
            }
          }}
          placeholder="Option"
          className="h-6 w-24 rounded-full border border-border-strong bg-surface-2 px-2.5 text-xs text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-brand"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={cn(pillClassName, "border-dashed text-text-muted hover:bg-surface-1")}
        >
          + Add
        </button>
      )}
    </div>
  );
}
