"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { LoadingOverlay } from "@/components/loading-overlay";
import { clientFetch, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { BookingStatus } from "@/lib/bookings";

type Action = "approve" | "reject" | "cancel";

const SUCCESS_MESSAGE: Record<Action, string> = {
  approve: "Booking approved. Customer has been notified.",
  reject: "Booking rejected. Customer has been notified.",
  cancel: "Booking cancelled. Customer has been notified.",
};

export function BookingActions({
  bookingId,
  status,
  initialOwnerNotes,
  returnStatus,
}: {
  bookingId: number;
  status: BookingStatus;
  initialOwnerNotes: string | null;
  returnStatus: BookingStatus | "all";
}) {
  const router = useRouter();
  // Starts empty for every action — owner_notes is one column, not a
  // per-action log, so pre-filling from the last action's note would
  // silently carry it forward onto whatever action is taken next.
  const [ownerNotes, setOwnerNotes] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setError(null);
    setPending(action);
    try {
      await clientFetch(`/owner/bookings/${bookingId}/${action}`, {
        method: "PATCH",
        body: JSON.stringify({ ownerNotes }),
      });
      toast.success(SUCCESS_MESSAGE[action]);
      router.push(`/dashboard/bookings?status=${returnStatus}`);
    } catch (err) {
      // Persistent inline error per decision 5 — a toast alone would vanish
      // before the owner has a chance to read a 409 or network failure.
      setPending(null);
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Please try again.");
    }
  }

  const editable = status === "pending" || status === "approved";
  const showNotesCard = editable || Boolean(initialOwnerNotes);

  return (
    <div className="flex flex-col gap-3">
      {pending !== null && <LoadingOverlay />}

      {showNotesCard && (
        <div className="rounded-md border border-border-default bg-surface-2 p-4">
          {editable && initialOwnerNotes && (
            <div className="mb-3 border-b border-border-default pb-3">
              <p className="mb-0.5 text-xs text-text-muted">Previous note</p>
              <p className="text-base text-text-primary">{initialOwnerNotes}</p>
            </div>
          )}
          <p className="mb-3 text-sm text-text-secondary">
            Owner notes <span className="text-text-muted">(optional)</span>
          </p>
          {editable ? (
            <Textarea
              value={ownerNotes}
              onChange={(e) => setOwnerNotes(e.target.value)}
              placeholder="Add a note the customer will see, e.g. arrival time or preparation instructions"
              className="min-h-16"
            />
          ) : (
            <p className="text-base text-text-primary">{initialOwnerNotes}</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
          {error}
        </p>
      )}

      {status === "pending" && (
        <div className="flex justify-end gap-2">
          <Button variant="destructive" disabled={pending !== null} onClick={() => run("reject")}>
            Reject
          </Button>
          <Button variant="default" disabled={pending !== null} onClick={() => run("approve")}>
            Approve
          </Button>
        </div>
      )}

      {status === "approved" && (
        <div className="flex justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="destructive" disabled={pending !== null}>
                  Cancel booking
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                <AlertDialogDescription>
                  The customer will be notified by email. This can&apos;t be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep booking</AlertDialogCancel>
                <AlertDialogAction onClick={() => run("cancel")}>Cancel booking</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}
