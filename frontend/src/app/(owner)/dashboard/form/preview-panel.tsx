import { Square, Circle, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormField } from "@/lib/form-builder";

// Pure projection of the in-memory field list — no fetch, no submit. Reflects
// unsaved adds/edits/reorders immediately since it reads the same state the
// rest of the screen does, rather than the last-saved server state.
export function PreviewPanel({ fields }: { fields: FormField[] }) {
  const sorted = [...fields].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((field) => (
        <div key={field.id}>
          <label className="mb-1.5 block text-sm font-medium text-text-primary">
            {field.label} {!field.isRequired && <span className="text-text-muted">(optional)</span>}
          </label>

          {field.fieldType === "text" && <Input disabled placeholder="Customer's answer" />}

          {field.fieldType === "textarea" && <Textarea disabled placeholder="Customer's answer" />}

          {field.fieldType === "dropdown" && (
            <div className="flex h-8 items-center justify-between rounded-sm border border-border-strong bg-surface-1 px-2.5 text-sm text-text-muted">
              <span>Select an option</span>
              <ChevronDown className="size-4" strokeWidth={1.5} />
            </div>
          )}

          {(field.fieldType === "checkbox" || field.fieldType === "radio") && (
            <div className="flex flex-col gap-1.5">
              {(field.options ?? []).map((option) => {
                const Icon = field.fieldType === "checkbox" ? Square : Circle;
                return (
                  <div key={option} className="flex items-center gap-2 text-sm text-text-secondary">
                    <Icon className="size-4 text-text-muted" strokeWidth={1.5} />
                    {option}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
