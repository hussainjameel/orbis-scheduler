export type BookingStatus = "pending" | "approved" | "rejected" | "cancelled";

export const BOOKING_STATUSES: {
  value: BookingStatus;
  label: string;
  badgeClassName: string;
}[] = [
  { value: "pending", label: "Pending", badgeClassName: "bg-pending text-pending-text" },
  { value: "approved", label: "Approved", badgeClassName: "bg-approved text-approved-text" },
  { value: "rejected", label: "Rejected", badgeClassName: "bg-rejected text-rejected-text" },
  { value: "cancelled", label: "Cancelled", badgeClassName: "bg-cancelled text-cancelled-text" },
];

export interface BookingListItem {
  id: number;
  customerName: string;
  customerEmail: string;
  bookingDate: string;
  bookingTime: string;
  status: BookingStatus;
  createdAt: string;
}

export interface BookingCounts {
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  all: number;
}

export interface BookingsResponse {
  bookings: BookingListItem[];
  total: number;
  page: number;
  totalPages: number;
  counts: BookingCounts;
}
