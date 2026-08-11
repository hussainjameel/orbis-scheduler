import type { FormField } from "@/lib/form-builder";

// Shape of GET /public/businesses/:businessId, widened (see backend/src/routes/public.ts)
// to also carry the weekly availability pattern and the business's active booking form —
// neither existed on this endpoint before; both are needed to render this page in one load.
export interface WeeklyAvailabilityDay {
  dayOfWeek: number; // project convention: 0=Monday..6=Sunday
  isAvailable: boolean;
}

export interface PublicBookingForm {
  id: number;
  title: string;
  description: string | null;
  bookingWindowDays: number;
  fields: FormField[];
}

export interface PublicBusiness {
  id: string;
  name: string;
  description: string | null;
  phone: string | null;
  availability: WeeklyAvailabilityDay[];
  form: PublicBookingForm | null;
}

// GET /public/slots
export interface Slot {
  time: string; // "HH:MM", 24h
  available: boolean;
}

export interface SlotsResponse {
  date: string;
  slotDurationMinutes: number | null;
  slots: Slot[];
}

// POST /public/bookings
export interface BookingSubmitPayload {
  businessId: string;
  formId: number;
  bookingDate: string;
  bookingTime: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  fieldValues: { formFieldId: number; value: string }[];
}

export interface BookingSuccessResponse {
  id: number;
  status: "pending";
  bookingDate: string;
  bookingTime: string;
  message: string;
}

// Dynamic field answers as edited in the form: text/textarea/dropdown/radio are a
// single string, checkbox is a set of independently-toggled options.
export type FieldValue = string | string[];
export type FieldValueMap = Record<number, FieldValue>;

// JS's Date.getDay() is 0=Sunday..6=Saturday; the backend's AvailabilityRule.dayOfWeek
// (and this function) use 0=Monday..6=Sunday throughout, matching public.ts's own
// `(jsDay + 6) % 7` conversion exactly.
export function dayOfWeekFromDate(date: Date): number {
  return (date.getDay() + 6) % 7;
}

// Local-calendar YYYY-MM-DD — never toISOString(), which would shift the date under UTC
// offsets west of Greenwich and silently book the wrong day.
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isClosedWeekday(date: Date, availability: WeeklyAvailabilityDay[]): boolean {
  const rule = availability.find((a) => a.dayOfWeek === dayOfWeekFromDate(date));
  return !rule || !rule.isAvailable;
}

export function hasAnyAvailability(availability: WeeklyAvailabilityDay[]): boolean {
  return availability.some((a) => a.isAvailable);
}

export function bookingWindowEnd(bookingWindowDays: number, from: Date = new Date()): Date {
  const end = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  end.setDate(end.getDate() + bookingWindowDays);
  return end;
}

function isFieldValueEmpty(value: FieldValue | undefined): boolean {
  if (value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  return value.trim().length === 0;
}

// Client-side, decision-4-scoped: only the free "is something here" check. Anything with
// real logic (option validity, slot availability) round-trips to the server as-is.
// Name/Email/Phone are not special-cased here — they're just three of the entries in
// `fields` (auth.ts's registration seed), so their required-ness falls out of the same
// generic loop as everything else, matching the backend's own validation (which checks
// every FormField's requiredness against `fieldValues`, never against a top-level
// customerName/customerEmail string).
export function validateRequiredFields(fields: FormField[], values: FieldValueMap): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (field.isRequired && isFieldValueEmpty(values[field.id])) {
      errors[String(field.id)] = `${field.label} is required`;
    }
  }

  return errors;
}

// Mirrors the backend's own EMAIL_RULE exactly (backend/src/routes/public.ts, itself
// copied from auth.ts's registration check) — sanctioned by decision 4 as a "free" check
// to duplicate client-side since it's reading the same shape rule, not separate logic
// that could drift. Only checked when non-empty; an empty required Email field is already
// caught by validateRequiredFields.
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmailFormat(fields: FormField[], values: FieldValueMap): Record<string, string> {
  const emailField = fields.find((f) => f.isProtected && f.label === "Email");
  if (!emailField) return {};

  const value = values[emailField.id];
  const str = typeof value === "string" ? value.trim() : "";
  if (str && !EMAIL_SHAPE.test(str)) {
    return { [String(emailField.id)]: "Enter a valid email address." };
  }
  return {};
}

// Checkbox answers are joined into one ", "-separated string — matches how the owner
// booking-detail screen already expects to read them back (bookings/[id]/page.tsx).
export function buildFieldValues(fields: FormField[], values: FieldValueMap): { formFieldId: number; value: string }[] {
  return fields
    .map((field) => {
      const raw = values[field.id];
      const value = Array.isArray(raw) ? raw.join(", ") : (raw ?? "");
      return { formFieldId: field.id, value };
    })
    .filter((fv) => fv.value.trim().length > 0);
}

// The Booking row's own denormalized customerName/customerEmail/customerPhone columns
// are populated from whichever fields play those roles — Name/Email reliably (isProtected,
// can never be renamed or deleted), Phone best-effort (see DynamicFormFields' own comment
// on why it can't be pinned down the same way).
export function resolveCustomerIdentity(
  fields: FormField[],
  values: FieldValueMap
): { name: string; email: string; phone: string } {
  const nameField = fields.find((f) => f.isProtected && f.label === "Name");
  const emailField = fields.find((f) => f.isProtected && f.label === "Email");
  const phoneField = fields.find((f) => !f.isProtected && f.label === "Phone");

  const asString = (id: number | undefined) => {
    if (id === undefined) return "";
    const value = values[id];
    return typeof value === "string" ? value.trim() : "";
  };

  return {
    name: asString(nameField?.id),
    email: asString(emailField?.id),
    phone: asString(phoneField?.id),
  };
}
