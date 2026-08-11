"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// Vertical list for radio (single-select) and checkbox (multi-select) — real native
// <input type="radio"/"checkbox"> under an appearance-none custom indicator, not divs
// with onClick, so keyboard nav/screen readers/form semantics all work for free. Each
// option is one <label> wrapping both the indicator and the text, so clicking the label
// selects it, not just the small indicator target.
export function FieldChoiceList({
  fieldId,
  options,
  multiple,
  value,
  onChange,
}: {
  fieldId: number;
  options: string[];
  multiple: boolean;
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
}) {
  const selectedSet = new Set(multiple ? ((value as string[] | undefined) ?? []) : value ? [value as string] : []);

  function toggle(option: string) {
    if (multiple) {
      const current = (value as string[] | undefined) ?? [];
      onChange(current.includes(option) ? current.filter((o) => o !== option) : [...current, option]);
    } else {
      onChange(option);
    }
  }

  return (
    <div className="flex flex-col gap-3" role={multiple ? "group" : "radiogroup"}>
      {options.map((option) => {
        const selected = selectedSet.has(option);
        return (
          <label key={option} className="flex cursor-pointer items-center gap-3">
            <span className="relative flex size-[18px] shrink-0 items-center justify-center">
              <input
                type={multiple ? "checkbox" : "radio"}
                name={multiple ? undefined : `field-${fieldId}`}
                checked={selected}
                onChange={() => toggle(option)}
                className={cn(
                  "peer absolute inset-0 m-0 cursor-pointer appearance-none border border-border-strong bg-surface-2",
                  multiple ? "rounded-sm checked:border-brand checked:bg-brand" : "rounded-full checked:border-brand"
                )}
              />
              {/* relative: a positioned <input> (absolute) always paints above a static
                  sibling regardless of DOM order, so without this the indicator would be
                  silently hidden underneath the input every time. */}
              {multiple ? (
                <Check
                  className="pointer-events-none relative size-3 text-brand-on opacity-0 peer-checked:opacity-100"
                  strokeWidth={3}
                />
              ) : (
                <span className="pointer-events-none relative size-2 rounded-full bg-brand opacity-0 peer-checked:opacity-100" />
              )}
            </span>
            <span className={cn("text-sm text-text-primary", selected ? "font-medium" : "font-normal")}>{option}</span>
          </label>
        );
      })}
    </div>
  );
}
