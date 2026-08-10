"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { fieldTypeLabel, type FormField, type FieldRowValues } from "@/lib/form-builder";
import { FieldEditForm } from "./field-edit-form";

export function FieldRow({
  field,
  isExpanded,
  dragDisabled,
  onExpand,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  isDuplicateLabel,
  submitting,
  serverError,
}: {
  field: FormField;
  isExpanded: boolean;
  dragDisabled: boolean;
  onExpand: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (values: FieldRowValues) => void | Promise<void>;
  onDelete: () => void;
  isDuplicateLabel: (label: string) => boolean;
  submitting: boolean;
  serverError: string | null;
}) {
  // Every row participates in useSortable (protected included) so it still
  // animates out of the way when a draggable row is dropped past it — only
  // the drag *listeners* are withheld from protected rows, since nothing
  // renders a handle for them to grab in the first place.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-t border-border-default first:border-t-0",
        isExpanded ? "bg-surface-1" : "bg-surface-2",
        isDragging && "z-10 opacity-80"
      )}
    >
      <div
        role={field.isProtected ? undefined : "button"}
        tabIndex={field.isProtected ? undefined : 0}
        onClick={field.isProtected ? undefined : onExpand}
        onKeyDown={
          field.isProtected
            ? undefined
            : (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onExpand();
                }
              }
        }
        className={cn(
          "flex items-center gap-3 px-4 py-3",
          !field.isProtected && !isExpanded && "cursor-pointer hover:bg-surface-1"
        )}
      >
        {field.isProtected ? (
          <Lock className="size-4 shrink-0 text-text-muted" strokeWidth={1.5} />
        ) : (
          <button
            type="button"
            aria-label="Drag to reorder"
            className="shrink-0 cursor-grab touch-none text-text-muted hover:text-text-secondary active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
            disabled={dragDisabled}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // dnd-kit's keyboard sensor uses Space/Enter to pick up and
              // drop a drag on this handle — without stopping propagation
              // here, the same keydown bubbles to the row's own handler
              // below and expands the row at the same time.
              e.stopPropagation();
              listeners?.onKeyDown?.(e);
            }}
          >
            <GripVertical className="size-4" strokeWidth={1.5} />
          </button>
        )}

        <span className="flex-1 truncate text-base text-text-primary">{field.label}</span>
        <span className="shrink-0 text-sm text-text-secondary">{fieldTypeLabel(field.fieldType)}</span>
        {field.isRequired && <span className="shrink-0 text-xs text-text-muted">Required</span>}
      </div>

      {isExpanded && (
        <div className="pl-11 pr-4 pb-4">
          <FieldEditForm
            fieldType={field.fieldType}
            isNew={false}
            initialLabel={field.label}
            initialIsRequired={field.isRequired}
            initialOptions={field.options ?? []}
            isDuplicateLabel={(label) => isDuplicateLabel(label)}
            onCancel={onCancelEdit}
            onDelete={onDelete}
            onSubmit={onSaveEdit}
            submitting={submitting}
            serverError={serverError}
          />
        </div>
      )}
    </div>
  );
}
