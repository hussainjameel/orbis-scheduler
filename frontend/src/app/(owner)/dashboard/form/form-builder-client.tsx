"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";

import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { clientFetch, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  OPTIONS_REQUIRED_TYPES,
  findDuplicateLabel,
  type FormField,
  type FieldType,
  type FieldRowValues,
  type DraftField,
} from "@/lib/form-builder";
import { FieldRow } from "./field-row";
import { FieldEditForm } from "./field-edit-form";
import { AddFieldPanel } from "./add-field-panel";
import { PreviewPanel } from "./preview-panel";

type ExpandedId = number | "draft" | null;

function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : "Could not reach the server. Please try again.";
}

export function FormBuilderClient({ initialFields }: { initialFields: FormField[] }) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [expandedId, setExpandedId] = useState<ExpandedId>(null);
  const [draftField, setDraftField] = useState<DraftField | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rightView, setRightView] = useState<"add" | "preview">("add");

  // Resyncs local state after router.refresh() delivers fresh server data —
  // the non-RHF equivalent of AvailabilityForm's `values` prop resync.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFields(initialFields);
  }, [initialFields]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const dragDisabled = expandedId !== null;

  function collapse() {
    setExpandedId(null);
    setDraftField(null);
    setActionError(null);
  }

  function handleExpand(id: number) {
    setActionError(null);
    setExpandedId(id);
    setDraftField(null);
  }

  function handleAddType(fieldType: FieldType) {
    setActionError(null);
    setDraftField({ label: "", fieldType, isRequired: false, options: [] });
    setExpandedId("draft");
    setRightView("add");
  }

  function isDuplicateLabel(excludeId: number | undefined) {
    return (label: string) => findDuplicateLabel(fields, label, excludeId);
  }

  async function handleSaveNew(values: FieldRowValues) {
    if (!draftField) return;
    setSubmitting(true);
    setActionError(null);
    try {
      const needsOptions = OPTIONS_REQUIRED_TYPES.includes(draftField.fieldType);
      await clientFetch("/owner/form/fields", {
        method: "POST",
        body: JSON.stringify({
          label: values.label,
          fieldType: draftField.fieldType,
          isRequired: values.isRequired,
          ...(needsOptions ? { options: values.options } : {}),
        }),
      });
      toast.success("Field added to your booking form");
      collapse();
      router.refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveEdit(field: FormField, values: FieldRowValues) {
    setSubmitting(true);
    setActionError(null);
    try {
      const needsOptions = OPTIONS_REQUIRED_TYPES.includes(field.fieldType);
      await clientFetch(`/owner/form/fields/${field.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: values.label,
          isRequired: values.isRequired,
          ...(needsOptions ? { options: values.options } : {}),
        }),
      });
      toast.success("Field updated");
      collapse();
      router.refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(field: FormField) {
    setSubmitting(true);
    setActionError(null);
    try {
      await clientFetch(`/owner/form/fields/${field.id}`, { method: "DELETE" });
      toast.success("Field deleted");
      collapse();
      router.refresh();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const previous = fields;
    const reordered = arrayMove(fields, oldIndex, newIndex).map((f, index) => ({ ...f, displayOrder: index }));
    setFields(reordered);

    try {
      await clientFetch("/owner/form/fields/reorder", {
        method: "PUT",
        body: JSON.stringify(reordered.map((f) => ({ id: f.id, displayOrder: f.displayOrder }))),
      });
      router.refresh();
    } catch (err) {
      setFields(previous);
      toast.error(errorMessage(err));
    }
  }

  const previewFields: FormField[] = draftField
    ? [...fields, { ...draftField, id: -1, displayOrder: fields.length, isProtected: false }]
    : fields;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {submitting && <LoadingOverlay />}

      <div className="overflow-hidden rounded-md border border-border-default bg-surface-2">
        <DndContext
          id="form-builder-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {fields.map((field) => (
              <FieldRow
                key={field.id}
                field={field}
                isExpanded={expandedId === field.id}
                dragDisabled={dragDisabled}
                onExpand={() => handleExpand(field.id)}
                onCancelEdit={collapse}
                onSaveEdit={(values) => handleSaveEdit(field, values)}
                onDelete={() => handleDelete(field)}
                isDuplicateLabel={isDuplicateLabel(field.id)}
                submitting={submitting}
                serverError={expandedId === field.id ? actionError : null}
              />
            ))}
          </SortableContext>
        </DndContext>

        {expandedId === "draft" && draftField && (
          <div className="border-t border-border-default bg-surface-1">
            <div className="pl-11 pr-4 py-4">
              <FieldEditForm
                key={draftField.fieldType}
                fieldType={draftField.fieldType}
                isNew
                initialLabel={draftField.label}
                initialIsRequired={draftField.isRequired}
                initialOptions={draftField.options ?? []}
                isDuplicateLabel={isDuplicateLabel(undefined)}
                onTypeChange={(fieldType) => setDraftField((d) => (d ? { ...d, fieldType } : d))}
                onCancel={collapse}
                onSubmit={handleSaveNew}
                submitting={submitting}
                serverError={actionError}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={rightView === "add" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRightView("add")}
          >
            Add a field
          </Button>
          <Button
            type="button"
            variant={rightView === "preview" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setRightView("preview")}
          >
            Preview form
          </Button>
        </div>

        <div className="rounded-md border border-border-default bg-surface-2 p-4">
          {rightView === "add" ? (
            <AddFieldPanel onAdd={handleAddType} disabled={dragDisabled} />
          ) : (
            <PreviewPanel fields={previewFields} />
          )}
        </div>
      </div>
    </div>
  );
}
