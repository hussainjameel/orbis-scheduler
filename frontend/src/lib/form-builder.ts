import { z } from "zod";
import { Type, AlignLeft, ChevronDown, CheckSquare, CircleDot, type LucideIcon } from "lucide-react";

export type FieldType = "text" | "textarea" | "dropdown" | "checkbox" | "radio";

// Mirrors backend/src/routes/owner.ts's VALID_FIELD_TYPES / OPTIONS_REQUIRED_TYPES.
export const OPTIONS_REQUIRED_TYPES: FieldType[] = ["dropdown", "checkbox", "radio"];

export const FIELD_TYPES: { value: FieldType; label: string; icon: LucideIcon }[] = [
  { value: "text", label: "Text", icon: Type },
  { value: "textarea", label: "Text area", icon: AlignLeft },
  { value: "dropdown", label: "Dropdown", icon: ChevronDown },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "radio", label: "Radio", icon: CircleDot },
];

export function fieldTypeLabel(fieldType: FieldType): string {
  return FIELD_TYPES.find((t) => t.value === fieldType)?.label ?? fieldType;
}

export interface FormField {
  id: number;
  label: string;
  fieldType: FieldType;
  isRequired: boolean;
  displayOrder: number;
  options: string[] | null;
  isProtected: boolean;
}

export interface BookingFormResponse {
  id: number;
  title: string;
  description: string | null;
  bookingWindowDays: number;
  isActive: boolean;
  fields: FormField[];
}

// A field being added has no id yet and isn't in the fields array — this is
// its shape while the draft row is expanded, before POST assigns it one.
export type DraftField = Omit<FormField, "id" | "displayOrder" | "isProtected">;

export function findDuplicateLabel(
  fields: { id: number; label: string }[],
  label: string,
  excludeId: number | undefined
): boolean {
  const normalized = label.trim().toLowerCase();
  return fields.some((f) => f.id !== excludeId && f.label.trim().toLowerCase() === normalized);
}

// Validates a single row's editable properties (label, required, options).
// fieldType is intentionally not part of this schema — the backend rejects
// changing it after creation (PATCH /form/fields/:id 400s if present), so
// the type is fixed once a row exists and isn't re-validated per edit.
export function fieldRowSchema(fieldType: FieldType) {
  const needsOptions = OPTIONS_REQUIRED_TYPES.includes(fieldType);

  return z.object({
    label: z.string().trim().min(1, "Label is required"),
    isRequired: z.boolean(),
    options: z.array(z.string()).superRefine((options, ctx) => {
      if (needsOptions && options.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: `Add at least one option for this ${fieldTypeLabel(fieldType).toLowerCase()}`,
        });
      }
    }),
  });
}

export type FieldRowValues = z.infer<ReturnType<typeof fieldRowSchema>>;
