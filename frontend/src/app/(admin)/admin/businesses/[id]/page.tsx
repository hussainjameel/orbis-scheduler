import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { formatBookingDate } from "@/lib/bookings";
import { businessDisplayStatus, type AdminBusinessDetail } from "@/lib/admin";
import { StatusBadge } from "@/components/status-badge";
import { BusinessActions } from "./business-actions";

export default async function BusinessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let business: AdminBusinessDetail;
  try {
    business = await apiFetch<AdminBusinessDetail>(`/admin/businesses/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }
    throw err;
  }

  const display = businessDisplayStatus(business);

  return (
    <div className="flex flex-col">
      <Link href="/admin/businesses" className="mb-5 flex items-center gap-1.5 text-sm text-text-secondary">
        <ChevronLeft className="size-4" />
        Back to businesses
      </Link>

      <div className="mb-6 flex items-center gap-2.5">
        <h1 className="text-2xl font-medium text-text-primary">{business.name}</h1>
        <StatusBadge status={display.status} label={display.label} />
      </div>

      <div className="mb-3 rounded-md border border-border-default bg-surface-2 p-4">
        <p className="mb-3 text-sm text-text-secondary">Business</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="mb-0.5 text-xs text-text-muted">Name</p>
            <p className="text-base text-text-primary">{business.name}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs text-text-muted">Registered</p>
            <p className="text-base text-text-primary">{formatBookingDate(business.createdAt)}</p>
          </div>
          {business.contactEmail && (
            <div>
              <p className="mb-0.5 text-xs text-text-muted">Contact email</p>
              <p className="text-base text-text-primary">{business.contactEmail}</p>
            </div>
          )}
          {business.phone && (
            <div>
              <p className="mb-0.5 text-xs text-text-muted">Phone</p>
              <p className="text-base text-text-primary">{business.phone}</p>
            </div>
          )}
          {business.description && (
            <div className="col-span-2">
              <p className="mb-0.5 text-xs text-text-muted">Description</p>
              <p className="text-base leading-relaxed text-text-primary">{business.description}</p>
            </div>
          )}
        </div>
        {business.approvalStatus === "rejected" && business.rejectionReason && (
          <div className="mt-4 border-t border-border-default pt-4">
            <p className="mb-0.5 text-xs text-text-muted">Rejection reason</p>
            <p className="text-base text-text-primary">{business.rejectionReason}</p>
          </div>
        )}
      </div>

      <div className="mb-3 rounded-md border border-border-default bg-surface-2 p-4">
        <p className="mb-3 text-sm text-text-secondary">Owner</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <p className="mb-0.5 text-xs text-text-muted">Name</p>
            <p className="text-base text-text-primary">{business.owner.name}</p>
          </div>
          <div>
            <p className="mb-0.5 text-xs text-text-muted">Login email</p>
            <p className="text-base text-text-primary">{business.owner.email}</p>
          </div>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between rounded-md border border-border-default bg-surface-2 p-4">
        <p className="text-sm text-text-secondary">Total bookings since registration</p>
        <p className="text-xl font-medium text-text-primary">{business.totalBookings}</p>
      </div>

      <BusinessActions businessId={business.id} approvalStatus={business.approvalStatus} isActive={business.isActive} />
    </div>
  );
}
