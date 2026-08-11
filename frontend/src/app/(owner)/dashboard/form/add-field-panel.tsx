"use client";

import { FIELD_TYPES, type FieldType } from "@/lib/form-builder";

export function AddFieldPanel({
  onAdd,
  disabled,
}: {
  onAdd: (fieldType: FieldType) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-text-secondary">Click a type to add a new field</p>
      {FIELD_TYPES.map((type) => {
        const Icon = type.icon;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onAdd(type.value)}
            disabled={disabled}
            className="flex items-center gap-2 rounded-sm border border-border-strong px-3 py-2 text-left text-sm text-text-primary transition-colors hover:bg-surface-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon className="size-4 text-text-secondary" strokeWidth={1.5} />
            {type.label}
          </button>
        );
      })}
    </div>
  );
}
