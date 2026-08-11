"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OptionsEditor } from "./options-editor";
import {
  FIELD_TYPES,
  OPTIONS_REQUIRED_TYPES,
  fieldRowSchema,
  type FieldType,
  type FieldRowValues,
} from "@/lib/form-builder";

// One scoped form instance per expanded row (decision 15 — this is where the
// form builder's real validation complexity lives: per-type option
// requirements plus a duplicate-label check against sibling fields).
// fieldType is fixed for the lifetime of this instance — the parent remounts
// the whole component (via a `key` on fieldType) when a new-field draft's
// type changes, rather than trying to keep a zod resolver in sync with a
// value RHF wasn't initialised with.
export function FieldEditForm({
  fieldType,
  isNew,
  initialLabel,
  initialIsRequired,
  initialOptions,
  isDuplicateLabel,
  onTypeChange,
  onCancel,
  onDelete,
  onSubmit,
  submitting,
  serverError,
}: {
  fieldType: FieldType;
  isNew: boolean;
  initialLabel: string;
  initialIsRequired: boolean;
  initialOptions: string[];
  isDuplicateLabel: (label: string) => boolean;
  onTypeChange?: (fieldType: FieldType) => void;
  onCancel: () => void;
  onDelete?: () => void;
  onSubmit: (values: FieldRowValues) => void | Promise<void>;
  submitting: boolean;
  serverError: string | null;
}) {
  const needsOptions = OPTIONS_REQUIRED_TYPES.includes(fieldType);

  const form = useForm<FieldRowValues>({
    resolver: zodResolver(fieldRowSchema(fieldType)),
    defaultValues: {
      label: initialLabel,
      isRequired: initialIsRequired,
      options: initialOptions,
    },
  });

  function handleValid(values: FieldRowValues) {
    if (isDuplicateLabel(values.label)) {
      form.setError("label", { message: "A field with this label already exists" });
      return;
    }
    onSubmit(values);
  }

  return (
    <form onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <label htmlFor="field-label" className="mb-1.5 block text-sm font-medium text-text-primary">
            Label
          </label>
          <Input
            id="field-label"
            {...form.register("label")}
            aria-invalid={Boolean(form.formState.errors.label)}
            autoFocus
          />
          {form.formState.errors.label && (
            <p className="mt-1 text-xs text-rejected-text">{form.formState.errors.label.message}</p>
          )}
        </div>

        <div className="w-36 shrink-0">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">Type</span>
          <Select
            value={fieldType}
            onValueChange={(value) => onTypeChange?.(value as FieldType)}
            disabled={!isNew}
          >
            <SelectTrigger className="h-8 w-full rounded-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="w-20 shrink-0">
          <span className="mb-1.5 block text-sm font-medium text-text-primary">Required</span>
          <Controller
            name="isRequired"
            control={form.control}
            render={({ field }) => (
              <Switch checked={field.value} onCheckedChange={field.onChange} className="mt-1.5" />
            )}
          />
        </div>
      </div>

      {needsOptions && (
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text-primary">Options</span>
          <Controller
            name="options"
            control={form.control}
            render={({ field }) => <OptionsEditor options={field.value} onChange={field.onChange} />}
          />
          {form.formState.errors.options && (
            <p className="mt-1 text-xs text-rejected-text">{form.formState.errors.options.message}</p>
          )}
        </div>
      )}

      {serverError && (
        <p role="alert" className="border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
          {serverError}
        </p>
      )}

      <div className="flex items-center justify-between">
        {onDelete ? (
          <Button type="button" variant="destructive" size="sm" onClick={onDelete} disabled={submitting}>
            <Trash2 className="size-3.5" strokeWidth={1.5} />
            Delete
          </Button>
        ) : (
          <span />
        )}

        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="default" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" size="default" disabled={submitting}>
            Save
          </Button>
        </div>
      </div>
    </form>
  );
}
