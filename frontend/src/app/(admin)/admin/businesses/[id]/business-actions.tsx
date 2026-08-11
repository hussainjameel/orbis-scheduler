"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { clientFetch, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { BusinessApprovalStatus } from "@/lib/admin";

type Action = "approve" | "reject" | "suspend" | "activate";

const SUCCESS_MESSAGE: Record<Action, string> = {
  approve: "Business approved. Owner has been notified.",
  reject: "Business rejected. Owner has been notified.",
  suspend: "Business suspended.",
  activate: "Business activated.",
};

export function BusinessActions({
  businessId,
  approvalStatus,
  isActive,
}: {
  businessId: string;
  approvalStatus: BusinessApprovalStatus;
  isActive: boolean;
}) {
  const router = useRouter();
  // Two-step reject flow: the reason field only appears once Reject is
  // clicked, replacing the button row in place — not a permanently visible
  // field.
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action, body?: Record<string, unknown>) {
    setError(null);
    setPending(action);
    try {
      await clientFetch(`/admin/businesses/${businessId}/${action}`, {
        method: "PATCH",
        body: JSON.stringify(body ?? {}),
      });
      toast.success(SUCCESS_MESSAGE[action]);
      // Unlike the owner booking-detail equivalent, this component stays
      // mounted after success (router.refresh() re-renders the same route
      // rather than navigating away), so pending must be cleared explicitly
      // — otherwise the LoadingOverlay and disabled buttons get stuck forever.
      setPending(null);
      router.refresh();
    } catch (err) {
      setPending(null);
      setError(err instanceof ApiError ? err.message : "Could not reach the server. Please try again.");
    }
  }

  if (approvalStatus === "rejected") {
    // Terminal state — no clear-rejection endpoint exists, so no actions.
    return error ? (
      <p role="alert" className="border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
        {error}
      </p>
    ) : null;
  }

  return (
    <div className="flex flex-col gap-3">
      {pending !== null && <LoadingOverlay />}

      {rejecting && (
        <div className="rounded-md border border-border-default bg-surface-2 p-4">
          <p className="mb-3 text-sm text-text-secondary">Rejection reason</p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this registration is being rejected — the owner will see this"
            className="min-h-20"
            aria-invalid
          />
        </div>
      )}

      {error && (
        <p role="alert" className="border-l-2 border-rejected-text bg-rejected px-3 py-2 text-sm text-rejected-text">
          {error}
        </p>
      )}

      {approvalStatus === "pending" && !rejecting && (
        <div className="flex justify-end gap-2">
          <Button variant="destructive" disabled={pending !== null} onClick={() => setRejecting(true)}>
            Reject
          </Button>
          <Button variant="default" disabled={pending !== null} onClick={() => run("approve")}>
            Approve
          </Button>
        </div>
      )}

      {approvalStatus === "pending" && rejecting && (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            disabled={pending !== null}
            onClick={() => {
              setRejecting(false);
              setReason("");
              setError(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending !== null || reason.trim().length === 0}
            onClick={() => run("reject", { rejectionReason: reason.trim() })}
          >
            Confirm rejection
          </Button>
        </div>
      )}

      {approvalStatus === "approved" && isActive && (
        <div className="flex justify-end gap-2">
          <Button variant="destructive" disabled={pending !== null} onClick={() => run("suspend")}>
            Suspend
          </Button>
        </div>
      )}

      {approvalStatus === "approved" && !isActive && (
        <div className="flex justify-end gap-2">
          <Button variant="default" disabled={pending !== null} onClick={() => run("activate")}>
            Activate
          </Button>
        </div>
      )}
    </div>
  );
}
