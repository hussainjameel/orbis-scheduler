"use client";

import type { FormField } from "@/lib/form-builder";
import type { FieldValueMap } from "@/lib/public-booking";
import { cn } from "@/lib/utils";
import { FieldSelect } from "./field-select";
import { FieldChoiceList } from "./field-choice-list";

// Border-bottom-only fields — a genuinely new pattern for this app (every existing
// input elsewhere is a bordered box), built exactly per the locked design brief.
const UNDERLINE_INPUT =
  "w-full border-0 border-b border-border-strong bg-transparent px-0 py-2 text-base text-text-primary placeholder:text-text-muted outline-none focus:border-brand aria-invalid:border-rejected-text";

function FieldLabel({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-medium text-text-primary">
      {children} {optional && <span className="font-normal text-text-muted">(optional)</span>}
    </label>
  );
}

function FieldErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rejected-text">{message}</p>;
}

// Renders one field, any type. There is no field this doesn't cover — Name/Email/Phone
// are not a separate hardcoded input set, they're just the three fields every business
// happens to start with (auth.ts's registration seed), rendered the same generic way as
// anything the owner added later. A4 (UC2): the "unmodified form" case (just Name/Email/
// Phone) falls out of this automatically, with no special-cased branch.
function FieldInput({
  field,
  value,
  onChange,
  error,
  inputType = "text",
}: {
  field: FormField;
  value: FieldValueMap[number] | undefined;
  onChange: (value: string | string[]) => void;
  error?: string;
  inputType?: "text" | "email" | "tel";
}) {
  return (
    <div>
      <FieldLabel optional={!field.isRequired}>{field.label}</FieldLabel>
      {field.fieldType === "text" && (
        <input
          type={inputType}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={UNDERLINE_INPUT}
        />
      )}
      {field.fieldType === "textarea" && (
        <textarea
          rows={3}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={Boolean(error)}
          className={cn(UNDERLINE_INPUT, "resize-none")}
        />
      )}
      {field.fieldType === "dropdown" && (
        <FieldSelect
          fieldLabel={field.label}
          options={field.options ?? []}
          value={value as string | undefined}
          onChange={onChange}
          invalid={Boolean(error)}
        />
      )}
      {field.fieldType === "radio" && (
        <FieldChoiceList
          fieldId={field.id}
          options={field.options ?? []}
          multiple={false}
          value={value as string | undefined}
          onChange={onChange}
        />
      )}
      {field.fieldType === "checkbox" && (
        <FieldChoiceList
          fieldId={field.id}
          options={field.options ?? []}
          multiple
          value={value as string[] | undefined}
          onChange={onChange}
        />
      )}
      <FieldErrorText message={error} />
    </div>
  );
}

// Name and Email are always present and immutable (auth.ts seeds them isProtected —
// the owner API 403s on any attempt to edit or delete either one), so matching on
// isProtected is a reliable way to single them out for the "universal fields" grid the
// locked design calls for. Phone has no such guarantee — it's required by default but
// not protected, so a business can rename or remove it (AF Architects renamed theirs to
// "Mobile Number") or delete it outright; matched by its default label only, same
// best-effort precedent already used by the owner booking-detail screen
// (DEFAULT_FIELD_LABELS in bookings/[id]/page.tsx). If renamed, it simply renders as an
// ordinary field below instead of in the top grid — still fully correct, just not
// specially grouped.
export function DynamicFormFields({
  fields,
  values,
  onValueChange,
  errors,
}: {
  fields: FormField[];
  values: FieldValueMap;
  onValueChange: (fieldId: number, value: string | string[]) => void;
  errors: Record<string, string>;
}) {
  const nameField = fields.find((f) => f.isProtected && f.label === "Name");
  const emailField = fields.find((f) => f.isProtected && f.label === "Email");
  const phoneField = fields.find((f) => !f.isProtected && f.label === "Phone");
  const universal = [nameField, emailField, phoneField].filter((f): f is FormField => Boolean(f));
  const universalIds = new Set(universal.map((f) => f.id));
  const rest = fields.filter((f) => !universalIds.has(f.id));

  return (
    <div className="flex flex-col gap-8">
      {universal.length > 0 && (
        <div className="flex flex-col gap-6 sm:grid sm:grid-cols-2">
          {universal.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              value={values[field.id]}
              onChange={(v) => onValueChange(field.id, v)}
              error={errors[String(field.id)]}
              inputType={field.id === emailField?.id ? "email" : field.id === phoneField?.id ? "tel" : "text"}
            />
          ))}
        </div>
      )}

      {rest.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.id]}
          onChange={(v) => onValueChange(field.id, v)}
          error={errors[String(field.id)]}
        />
      ))}
    </div>
  );
}
