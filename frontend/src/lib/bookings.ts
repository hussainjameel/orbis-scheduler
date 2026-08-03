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

export type FieldType = "text" | "textarea" | "dropdown" | "checkbox" | "radio";

export interface BookingFieldValue {
  label: string;
  value: string | null;
  fieldType: FieldType;
  options: string[] | null;
}

export interface BookingDetail {
  id: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  bookingDate: string;
  bookingTime: string;
  status: BookingStatus;
  ownerNotes: string | null;
  createdAt: string;
  fieldValues: BookingFieldValue[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatBookingDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
  return `${day} ${MONTHS[month! - 1]} ${year}`;
}

export function formatBookingTime(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const period = hours! >= 12 ? "PM" : "AM";
  const hour12 = hours! % 12 === 0 ? 12 : hours! % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
