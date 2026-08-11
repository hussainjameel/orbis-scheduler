"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Reuses the same Select the Availability screen's time pickers already use
// (day-card.tsx) rather than a second select implementation — real keyboard/
// screen-reader listbox semantics come for free from Base UI's primitive.
export function FieldSelect({
  fieldLabel,
  options,
  value,
  onChange,
  invalid,
}: {
  fieldLabel: string;
  options: string[];
  value: string | undefined;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  return (
    // Always controlled from first render (never `undefined`) — Base UI otherwise warns
    // about switching from uncontrolled to controlled once a value is first picked. An
    // empty string still counts as "no selection" for placeholder purposes (Base UI
    // treats a value serializing to '' as empty), so the placeholder still shows correctly.
    <Select value={value ?? ""} onValueChange={(v) => v && onChange(v)}>
      <SelectTrigger
        className="h-11 w-full rounded-lg border-border-strong bg-surface-2 text-text-primary"
        aria-invalid={invalid}
      >
        <SelectValue placeholder={`Select ${fieldLabel.toLowerCase()}...`} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
