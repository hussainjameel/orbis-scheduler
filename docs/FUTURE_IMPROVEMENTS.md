# Orbis Scheduler — Future Improvements

Deliberately deferred beyond MVP scope. Not bugs — documented tradeoffs made to hit the trimester timeline.

## Availability & Scheduling

- Seasonal/date-ranged availability rules — currently one fixed recurring weekly template only, no way to set different hours for a specific date range (e.g. holiday hours).

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

## Documentation corrections needed

- UC9 alternate flow A3 states cross-tenant booking access returns "403 Forbidden." The actual implementation consistently returns `404` across the entire codebase (chosen for its stronger anti-enumeration property — a `403` would confirm a resource exists). Doc wording is stale and should be updated to match.
- The API endpoint reference doc's header states "27 routes," but the document's own per-group table sums to 29. Stale count, should be corrected.
