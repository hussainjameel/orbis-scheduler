# Orbis Scheduler — Future Improvements

Deliberately deferred beyond MVP scope. Not bugs — documented tradeoffs made to hit the trimester timeline.

## Availability & Scheduling

- Seasonal/date-ranged availability rules — currently one fixed recurring weekly template only, no way to set different hours for a specific date range (e.g. holiday hours).
- `PUT /owner/availability`'s success response is just `{ message }` — no count of existing bookings that now fall outside the new hours. UC7 alternate flow A4 specifies a save-time warning ("You have N existing bookings outside your new hours. Those bookings remain valid.") once this data exists; the frontend availability screen was built without it since there's nothing to show yet. Needs the route to compute affected bookings (approved/pending rows whose `bookingTime` falls outside the newly-saved day's `startTime`/`endTime`/break, or on now-closed days) and return an `affectedBookingsCount` alongside `message`.

## Admin & Platform

- Audit logging for admin actions (who approved/rejected/suspended a business, and when).
- Selectable stats date range for `GET /admin/stats` — currently two fixed windows only (all-time lifetime total, rolling 7-day recent activity). A future version could offer last week/month/year or a custom range picker.
- Suspension notification email to business owners — currently silent by design (per the use case doc).

## Registration & Trust

- Email verification at registration.
- CAPTCHA at registration.
- Business identity verification (ABN/ACN check) before approval.

## Email Infrastructure

- Migrate from Mailtrap Sandbox to a real SMTP provider and domain at deployment time (e.g. Resend, SendGrid, or Mailtrap's own live-sending product).
- HTML email templates — currently plain text only.

## Performance

- Add an index on `Booking(businessId, status)` — currently only the primary key is indexed. Fine at current data volume; worth adding before real production load, since the owner bookings list filters and sorts on both columns.
- `booking_field_values` duplicates Name/Email/Phone that already exist as dedicated columns on `bookings` — every submission stores these three values twice. Deliberate per UC3 (field-by-field record of the full form, including protected fields), not a bug. Low priority; revisit only if storage or query complexity becomes a real concern.

## File Uploads & Storage

- Logo upload (Business Profile) and file-type form fields (PDF/PNG/JPEG/Word etc. on the customer booking form) both require object storage (S3/R2 or similar) plus a new multipart upload endpoint — neither exists yet. Not a variation on the existing PATCH pattern: needs a storage provider decision, an upload route, file-type/size validation, and a new `logo_url`-style column on `businesses`. For booking-form file fields specifically, the customer would need to upload and receive a URL back before that URL is saved as their `booking_field_values.value` (which is a plain text column). Deferred past MVP/trimester deadline — real new infrastructure, not a quick add-on.

## Documentation corrections needed

- UC9 alternate flow A3 states cross-tenant booking access returns "403 Forbidden." The actual implementation consistently returns `404` across the entire codebase (chosen for its stronger anti-enumeration property — a `403` would confirm a resource exists). Doc wording is stale and should be updated to match.
- The API endpoint reference doc's header states "27 routes," but the document's own per-group table sums to 29. Stale count, should be corrected.
- UC2 A3 ("This slot was just booked, please select another") and UC3 A1 ("Sorry, this slot was just requested by someone else. Please select another time.") give two different wordings for what the shipped code treats as one event — `POST /public/bookings` returns a single message, `"This slot was just taken. Please select another time."`, on both the optimistic pre-check and the real DB-race path. Neither UC's copy matches what actually ships. The two use cases should be reconciled with each other and with the real string.
- UC2 A2 quotes "Invalid value for [field label]"; the backend actually returns `"${field.label} must be one of the provided options"` (`public.ts`). Doc wording is stale.
- UC1 alternate flows A1–A4 describe three distinguishable customer-facing messages for a nonexistent/pending/rejected/suspended business. The backend deliberately returns one identical `404` for all four (the same anti-enumeration property as the UC9/403 point above), so no frontend can ever show the differentiated copy UC1 describes. Doc should be updated to reflect the one-message reality.
