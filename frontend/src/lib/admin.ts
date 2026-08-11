import type { BookingStatus } from "@/lib/bookings";

export type BusinessApprovalStatus = "pending" | "approved" | "rejected";

export interface AdminStats {
  totalBusinesses: number;
  pendingRegistrations: number;
  approvedBusinesses: number;
  rejectedBusinesses: number;
  suspendedBusinesses: number;
  totalBookingsLifetime: number;
  bookingsThisWeek: number;
}

export interface AdminBusinessListItem {
  id: string;
  name: string;
  ownerName: string;
  ownerEmail: string;
  approvalStatus: BusinessApprovalStatus;
  isActive: boolean;
  totalBookings: number;
  createdAt: string;
}

export interface AdminBusinessesResponse {
  businesses: AdminBusinessListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AdminBusinessDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  approvalStatus: BusinessApprovalStatus;
  rejectionReason: string | null;
  createdAt: string;
  owner: { name: string; email: string };
  totalBookings: number;
}

// Maps a business's two independent status fields onto StatusBadge's booking-status
// colour pairs, per the design spec's rule that suspended businesses reuse the
// Cancelled colour pair. Only the suspended case needs a label override — pending/
// approved/rejected already read correctly as booking-status labels.
export function businessDisplayStatus(business: {
  approvalStatus: BusinessApprovalStatus;
  isActive: boolean;
}): { status: BookingStatus; label?: string } {
  if (business.approvalStatus === "approved" && !business.isActive) {
    return { status: "cancelled", label: "Suspended" };
  }
  return { status: business.approvalStatus };
}

export const BUSINESS_STATUS_FILTERS: {
  value: string;
  label: string;
  status?: BusinessApprovalStatus;
  isActive?: boolean;
}[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending", status: "pending" },
  { value: "approved", label: "Approved", status: "approved", isActive: true },
  { value: "rejected", label: "Rejected", status: "rejected" },
  { value: "suspended", label: "Suspended", status: "approved", isActive: false },
];
