"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { clientFetch, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";

export function TitleDescriptionForm({
  initialTitle,
  initialDescription,
}: {
  initialTitle: string;
  initialDescription: string | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [labelError, setLabelError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (title.trim().length === 0) {
      setLabelError("Title is required");
      return;
    }
    setLabelError(null);
    setSubmitError(null);
    setSubmitting(true);

    try {
      await clientFetch("/owner/form", {
        method: "PUT",
        body: JSON.stringify({ title, description }),
      });
      toast.success("Your booking form has been updated");
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Could not reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-border-default bg-surface-2 p-4">
      {submitting && <LoadingOverlay />}

      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="form-title" className="mb-1.5 block text-sm font-medium text-text-primary">
            Form title
          </label>
          <Input
            id="form-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={Boolean(labelError)}
          />
          {labelError && <p className="mt-1 text-xs text-rejected-text">{labelError}</p>}
        </div>

        <div>
          <label htmlFor="form-description" className="mb-1.5 block text-sm font-medium text-text-primary">
            Description <span className="text-text-muted">(optional)</span>
          </label>
          <Textarea
            id="form-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Shown to customers above the booking form"
          />
        </div>

        {submitError && (
          <p role="alert" className="border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
            {submitError}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            Save form
          </Button>
        </div>
      </div>
    </form>
  );
}
