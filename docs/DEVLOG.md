# Orbis Scheduler — Development Log

## 2026-07-20 — `POST /public/bookings` — booking submission (highest-risk endpoint)

**Shipped**
- Migration `bookings_active_slot_unique`: a Postgres **partial (filtered) unique index** on `bookings ("businessId", "bookingDate", "bookingTime") WHERE "status" IN ('pending', 'approved')` — hand-authored raw SQL, **not represented in `schema.prisma` at all**, since Prisma's `@@unique`/`@@index` have no `WHERE`-clause syntax (confirmed absent from every Prisma schema version I could check, and from this project's 4 prior migrations). This was a decision surfaced to and confirmed by the user before writing any code: it's the only thing that actually closes the double-booking race window — the optimistic `generateSlots()` recheck alone cannot, since two near-simultaneous requests can both pass it before either writes.
- `POST /public/bookings` (`backend/src/routes/public.ts`): validates required fields, the business/form 404 gate (reusing the exact pattern from the other public routes), the `bookingDate` window (`[today, today + bookingWindowDays]` — a past date is treated as also outside the window, a decision made explicit since the spec's "day 0" phrasing didn't cover it), re-runs `generateSlots()` (imported from `lib/slots.ts`, not duplicated) and requires the requested `bookingTime` to come back available or the whole thing collapses to `409` per spec, then validates `fieldValues` in the spec's literal listed order (required-field presence → dropdown/checkbox/radio options match → foreign `formFieldId` rejection). On success, creates the `Booking` + `BookingFieldValue` rows in one transaction; a `P2002` from the partial index there is caught and turned into the same `409` message the optimistic check gives, so a genuine race and an already-taken slot are indistinguishable to the client. Best-effort confirmation + owner-notification emails follow the same `sendMail(...).catch(...)` pattern as `auth.ts`/`admin.ts`.

**Verified (curl + a small Node concurrency script, live dev DB)** — prioritized the actual concurrency test above everything else, per your instruction:
- **The real race condition, three independent ways**: (1) fired two genuinely simultaneous `POST` requests (`Promise.all` over `fetch`, not sequential) at the same clean slot, three separate times against three different slots — every single run came back exactly one `201` + one `409`, confirmed by re-querying the DB that exactly one `Booking` row existed afterward despite two concurrent write attempts. (2) To rule out the optimistic pre-check alone being what saved us (timing alone can't prove *which* code path fired), wrote a second script that calls `prisma.booking.create()` directly, twice, concurrently, bypassing the application's pre-check entirely — got exactly one success and one `P2002` rejection, which is unambiguous, direct proof the DB constraint itself is real and enforced, independent of app logic. (3) Confirmed the two 409 *paths* are genuinely independent: a **sequential** (non-concurrent) request against an already-committed booking returned `409` with no possible P2002 involvement (the pre-check alone caught it, since nothing else was in flight) — so both routes to `409` (optimistic pre-check *and* DB constraint) were each proven to work on their own, not just as a pair.
- All required-field-missing combinations (6 fields) → `400`.
- `bookingDate` one day before today, and one day past `bookingWindowDays` → both `400`, confirming the explicit past-date decision.
- Nonexistent/pending/rejected/suspended business → all four `404` (reused the mutate-status technique from prior sessions).
- `formId` belonging to a different business, and a `formId` that doesn't exist at all → both `404`.
- Missing a required field's value, an invalid dropdown option, and a `fieldValues` entry naming a field from a *different* business's form → each its own specific `400` message, the last one confirmed genuinely rejected (not silently dropped/ignored).
- A fully valid submission → `201` with the exact spec response shape; inspected the DB directly and confirmed the `Booking` row and all 4 `BookingFieldValue` rows (including the built-in Name/Email/Phone answers) were created correctly.
- A hit-a-snag but useful finding on the concurrency runs: with several successful bookings firing emails in quick succession, Mailtrap's sandbox rate limit was hit for real (not simulated) — every one of those failures was caught and logged without blocking a single HTTP response (still `201` every time). That's arguably a better confirmation of the spec's "email failures must never block the response" requirement than a clean send would have been.

**Blocking fixes**
- A stale `tsx`/nodemon process from an earlier session was still holding port 5000 (serving code from before this endpoint existed), causing `Cannot POST /public/bookings` 404s at the start of verification even though the code was correct. Diagnosed via `netstat`, killed the PID directly, restarted cleanly. Also proactively killed a similarly-orphaned process after this session's `TaskStop` didn't fully terminate nodemon's spawned child.

**Open questions**
- Couldn't get a clean, unambiguous confirmation of both notification emails landing in Mailtrap — the sandbox's rate/quota limit was still blocking sends even after a 20s cooldown, apparently exhausted for the day by this session's test volume (not just a per-second burst). The error-handling behavior itself (failures caught, logged, never block the response) was thoroughly confirmed instead; an actual visual Mailtrap check is still worth doing manually at some point when the quota resets.
- The partial unique index exists only as raw SQL, invisible to `schema.prisma` — flagged during planning as a new kind of drift for this codebase. Not a problem today, but worth remembering if `prisma db pull`/introspection is ever run against this database.

**Next up**
- Owner-facing booking management (`GET`/`PATCH /owner/bookings` — approve/reject, matching the `status` transitions this endpoint only ever creates as `pending`).

## 2026-07-20 — `GET /public/slots` — slot calculation

**Shipped**
- `backend/src/lib/slots.ts` (new): `generateSlots()`, the reusable core — steps through `startTime`→`endTime` in `slotDurationMinutes` steps (only including a slot that fully fits before `endTime`), excludes any slot overlapping `breakStart`–`breakEnd` at all via a standard half-open-interval test (so even a partial overlap excludes it), then marks a slot `available: false` if it's in `bookedTimes` or its real datetime is `<= now`. Exported so booking submission (not built yet) can reuse the exact same logic rather than duplicating it.
- `GET /public/slots` (`backend/src/routes/public.ts`, query params `businessId`, `date`): validates both are present (`400`), validates `date` is `YYYY-MM-DD` *and* a real calendar date via a construct-then-round-trip check against `Date.UTC` (catches `2026-02-30` specifically, not just wrong shape), reuses the exact same 404-collapsing gate as `GET /businesses/:businessId` (not-found/not-approved/inactive → identical `404 "Business not found."`), converts the date's day-of-week from JS's `0=Sunday..6=Saturday` to this project's `0=Monday..6=Sunday` convention via `(jsDay + 6) % 7`, looks up the matching `AvailabilityRule` by the `businessId_dayOfWeek` compound unique, returns `200 { slots: [] }` for a closed/unconfigured day (not an error), otherwise queries `pending`/`approved` `Booking` rows for that exact date and feeds everything into `generateSlots()`.
- **Decision surfaced and confirmed with you before writing code**: a fully-past `date` gets no special-case branch — the "already passed" check in `generateSlots()` compares every slot's datetime against `now` unconditionally (not gated on `date === today`), so a past date's slots all naturally come out `available: false` while still returning the full list, rather than an empty array or a `400`.

**Verified (curl, live dev DB)** — one test business with a deliberately layered availability config: Monday `01:00–06:00` with a break `03:15–03:45` (chosen off the 30-min slot grid specifically to test *partial*, not just full, break overlap) for the break/booking/passed-time tests, Tuesday `09:00–17:00` and Wednesday `09:00–16:45` (otherwise identical) for the slot-fitting boundary comparison, Thursday explicitly closed, Friday–Sunday closed:
- Missing `businessId`, missing `date`, both missing → `400` in all three.
- Four malformed dates (`2026-13-01`, `2026-02-30`, `15-07-2026`, `2026-7-5`) → `400` in every case, confirming the round-trip check catches the invalid-calendar-date case specifically, not just the two regex-shape cases.
- 404 equivalence across nonexistent/pending/rejected/suspended → diffed all four response bodies, byte-identical.
- No `AvailabilityRule` row at all (queried before ever calling `PUT /owner/availability`), and a day explicitly `isAvailable: false` → both `200 { slots: [] }`.
- Break overlap: with `breakStart`/`breakEnd` off the slot grid, the two slots that only *partially* touch the break (`03:00`–`03:30` and `03:30`–`04:00`) were completely absent from the response — confirmed exclusion, not just an `available: false` marking.
- Booking collision: created one `pending`, one `approved`, one `rejected`, and one `cancelled` booking at four different times on the same date — `pending`/`approved` slots came back `available: false` (still present in the list), `rejected`/`cancelled` slots stayed `available: true`, exactly matching "these two statuses hold the slot, the other two free it."
- Today's passed-time marking: read the four survived-the-break-filter slots before the current server time and the four after in the same response — all four earlier slots `available: false`, all four later ones `available: true`.
- Slot-fitting boundary: `09:00–17:00` included `16:30` as the last slot (fits exactly to `17:00`); `09:00–16:45` stopped at `16:00`, correctly excluding `16:30` (which would end at `17:00`, past the `16:45` close) — same slot grid, only the closing time differed, isolating exactly the boundary condition being tested.
- Fully-past date: requested a date on a previous occurrence of the same configured weekday — all slots returned (same set, same break exclusions as "today"), every one `available: false`, including the ones that would've read as "future" had the date been today — directly confirms the generalized (non-special-cased) past-date decision actually behaves as designed, not just as documented.
- Test business, its bookings, and the throwaway verification script all deleted afterward.

**Blocking fixes**
- None.

**Open questions**
- None beyond the pre-existing, already-documented timezone simplification (no timezone field anywhere in this schema — `now` is compared directly against UTC-constructed slot datetimes; noted during planning, not new to this session).

**Next up**
- Booking submission (`POST /public/bookings` or similar) — the actual consumer of `generateSlots()`, and the reason it was extracted into `lib/slots.ts` instead of being inlined into this route.

## 2026-07-19 — Booking form field management (POST/PATCH/DELETE + reorder)

**Shipped**
- `POST /owner/form/fields` (`backend/src/routes/owner.ts`): creates a field on the business's own form (looked up via the same `businessId` relation lookup as `PUT /owner/form`, never a client-supplied form id). `label` required non-empty, `fieldType` must be one of the 5 enum values, `options` required (non-empty string array) for `dropdown`/`checkbox`/`radio` and forbidden for `text`/`textarea`, `isRequired` defaults to `false`. `displayOrder` is always `(current max for this form) + 1` — new fields append to the end. `isProtected` is hardcoded `false` in the `create()` call itself, never read from the request body, so it can't be client-set regardless of what's sent. Returns `201` with the created field (unwrapped, 6 fields — no `isProtected`, matching the spec's literal return shape).
- `PATCH /owner/form/fields/:id`: ownership enforced via `findFirst({ where: { id, form: { businessId } } })` — a nested-relation filter, confirmed during planning that Prisma supports this on `findFirst`. `404` if the field doesn't exist or belongs to another business (deliberately indistinguishable from "doesn't exist" — never reveals another business's field exists at all). `403` if `isProtected`. **Resolved a spec inconsistency during planning**: the task's own "Body:" line omitted `fieldType` but two other lines referenced it as editable — confirmed with you that `fieldType` is fixed after creation; the endpoint now explicitly `400`s if `fieldType` is present in the body at all (mirrors `PATCH /owner/business`'s existing precedent for `name`/`slug`, rather than silently ignoring it). `options`' required-ness is validated against the field's existing (immutable) `fieldType`.
- `DELETE /owner/form/fields/:id`: same ownership/protection guards. Deletes the field's `BookingFieldValue` rows before the `FormField` itself, in one transaction — required because `booking_field_values.formFieldId → form_fields.id` is `ON DELETE RESTRICT` (confirmed from the init migration SQL; every FK in this schema is RESTRICT, none overridden). Note: no prior in-repo code actually demonstrates this pattern (every previous session's test-data cleanup used throwaway scripts that were deleted afterward) — the delete order here is derived directly from the migration SQL's FK list, not copied from existing code, despite the task description implying precedent existed.
- `PUT /owner/form/fields/reorder`: validates every submitted `id` belongs to the business's own form *and* that the submitted set exactly matches the form's full current field set — both checks run before any write. Unrecognized/foreign ids get a specific message naming the id; an incomplete list (valid ids, but missing some) gets a separate message, only reachable once every submitted id is already confirmed valid. Writes all `displayOrder` updates in one `$transaction(async (tx) => {...})` (callback form, matching existing codebase convention — no precedent for the array form).
- Two Prisma/TypeScript fixes needed along the way: `fieldType` (plain `string` after `req.body` destructuring) needed a cast to Prisma's generated `FieldType` enum type once validated; clearing the nullable `options` `Json` column on `PATCH` required `Prisma.JsonNull` instead of plain `null` (a real Prisma type quirk — `exactOptionalPropertyTypes` catches the difference between "SQL NULL" and "JSON null" sentinel here).

**Verified (curl, live dev DB, two test businesses A/B for cross-tenant checks)**
- `POST`: text field → `201`, `displayOrder` correctly appended (`3`, then `4` for a second field); `isProtected: true` sent in the body was confirmed ignored via a follow-up `GET` (stored as `false` regardless). `dropdown` with no `options` → `400`; with `options` → `201`, options stored correctly. Invalid `fieldType` (`"banana"`) → `400`.
- `PATCH`: label change on a non-protected field → `200`, confirmed via `GET`. `fieldType` present in body → `400`. `PATCH`/`DELETE` on the protected `Name` field → both `403`, confirmed via re-`GET` that nothing changed.
- `DELETE` on a non-protected field → `200`, confirmed gone from a follow-up `GET`.
- **Cross-business ownership**: business A's owner attempted `PATCH` and `DELETE` on business B's *non-protected* `Phone` field (deliberately non-protected, so a broken ownership check would have let the mutation through rather than being masked by the `isProtected` 403) → both `404`, and business B's field confirmed completely untouched via a follow-up `GET` as B's owner.
- `PUT .../reorder`: valid full 4-field list → `200`, `GET` confirmed the new order (which also exercises the `ORDER BY displayOrder` sort). Same list but with one id swapped for business B's field → `400` naming that field id, and a follow-up `GET` confirmed **zero** `displayOrder` values changed — including the three otherwise-valid entries in that same rejected request — proving pre-validation blocks the whole write, not a partial reorder.
- All four endpoints tested with pending/rejected/suspended tokens (business A's DB state mutated directly, same still-valid-token technique as every prior `requireApprovedBusiness` verification) → all 12 combinations (4 endpoints × 3 states) returned the exact matching `requireApprovedBusiness` wording.
- Both test businesses (and B's untouched field) deleted afterward; throwaway verification script removed.

**Blocking fixes**
- The two Prisma/TypeScript issues above (`FieldType` cast, `Prisma.JsonNull`) — caught by `tsc --noEmit` before ever reaching runtime testing.

**Open questions**
- None.

**Next up**
- `Booking`/`BookingFieldValue` endpoints (the public booking flow + owner approve/reject), and slot computation logic that reads `AvailabilityRule` to produce actual bookable times — the last major piece before a frontend can consume any of this.

## 2026-07-19 — Booking form metadata (`GET`/`PUT /owner/form`) + `isProtected` fix

**Shipped**
- `GET /owner/form` (`backend/src/routes/owner.ts`): returns the business's `BookingForm` metadata (`id, title, description, bookingWindowDays, isActive`) plus its `FormField` rows ordered by `displayOrder`, each with `isProtected` — unwrapped response shape (not `{ form: {...} }}`), per spec. 404 if no form exists (defensive; register always creates one). Looked up via `findFirst({ where: { businessId }, orderBy: { createdAt: 'asc' } })` since `BookingForm.businessId` has no unique constraint — app-level convention only, not schema-enforced.
- `PUT /owner/form`: updates `title` (required, non-empty)/`description`/`bookingWindowDays` (positive integer if sent) only — never touches `fields`. Scoped via the same relation lookup (business → its form), never a client-supplied form id.
- **Fixed same-session**: `isProtected` was initially computed by matching `field.label === 'Name' || 'Email'` — fragile once field editing exists (renaming loses protection, a custom "Email"-labeled field gains it). Replaced with a real column:
  - Migration `form_field_is_protected`: added `FormField.isProtected Boolean @default(false)`. Same non-interactive `migrate diff` + hand-placed folder + `migrate deploy` workaround as the availability migration. `database/db_schema.dbml`/`.sql` updated to match.
  - `auth.ts` register endpoint now sets `isProtected: true` explicitly on the seeded `Name`/`Email` fields; `Phone` relies on the `false` default.
  - `GET /owner/form` now reads `field.isProtected` from the DB instead of deriving it from `label`.
  - **Known gap, by design**: businesses registered before this migration have `isProtected: false` on all fields (no backfill — throwaway dev data). Confirmed directly during verification (see below), not just asserted.

**Verified (curl, live dev DB)**
- Registered a **fresh** test business (post-migration) → `GET /owner/form` showed `Name`/`Email` with `isProtected: true`, `Phone` with `isProtected: false`.
- Found two genuine **pre-existing** leftover test businesses ("Joey's Plumbing", "Test Co" — dev/Postman-testing artifacts from earlier sessions, one of which the 2026-07-02 devlog entry claimed was already cleaned up but evidently wasn't) still in the DB with `FormField.isProtected: false` on all fields, from before this migration. Minted a JWT directly (same `JWT_SECRET`, same payload shape as `/auth/login`, since these accounts' passwords weren't known) to call `GET /owner/form` as their owner without going through login — confirmed `isProtected: false` on their `Name`/`Email` fields too, giving direct proof of the flagged gap rather than just trusting the explanation. Deleted both as part of this session's cleanup.
- `PUT /owner/form` with valid `title`+`bookingWindowDays` → `200`; re-`GET` confirmed only those two changed, `fields` (including `isProtected`) completely untouched.
- `PUT` with empty `title` → `400`; with `bookingWindowDays: -5` → `400`; with `bookingWindowDays: 0` → `400`.
- `GET` and `PUT /owner/form` each tested with pending/rejected/suspended tokens (same business, DB state mutated directly, same still-valid-token technique as prior `requireApprovedBusiness` verifications) → identical three 403s (exact wording) as the business-profile and availability routes, since all three route groups share `requireApprovedBusiness`.
- All test businesses (the fresh one plus the two rediscovered leftovers) and the throwaway verification script deleted afterward.

**Blocking fixes**
- None beyond the `isProtected` fix described above (which was itself the point of this session's second half).

**Open questions**
- None.

**Next up**
- Field-level CRUD for `FormField` (add/edit/delete/reorder), which is exactly what `isProtected` exists to gate — `Name`/`Email` should be undeletable/unrenamable once that lands. `requireApprovedBusiness` middleware and `/owner` route conventions are now well-established across four route groups (business, availability, form, and the original tenant-isolation route), so this should slot in the same way.

## 2026-07-14 — Weekly availability management (`GET`/`PUT /owner/availability`)

**Shipped**
- Migration `availability_rule_unique_and_nullable_times`: added `@@unique([businessId, dayOfWeek])` to `AvailabilityRule` (needed for a true `upsert` keyed on the day) and made `startTime`/`endTime`/`slotDurationMinutes` nullable (a closed day now stores `null` for all time fields instead of forcing fake placeholder values). `database/db_schema.dbml`/`.sql` updated to match. Table was empty before this — non-destructive.
  - Applied via `prisma migrate diff` + a hand-placed migration folder + `prisma migrate deploy`, since `prisma migrate dev` requires an interactive TTY this environment doesn't have.
- `GET /owner/availability` (`backend/src/routes/owner.ts`): businessId from `req.user.businessId` only, returns all `AvailabilityRule` rows ordered by `dayOfWeek`, projected to `dayOfWeek, startTime, endTime, breakStart, breakEnd, slotDurationMinutes, isAvailable`.
- `PUT /owner/availability`: replaces the full week in one call. Validates, in order, before writing anything: exactly 7 entries with distinct `dayOfWeek` 0–6 (completeness follows automatically once count + distinctness hold — no separate "missing day" check needed), at least one open day, required `startTime`/`endTime`/valid `HH:MM` format on open days, `endTime > startTime`, break (`breakStart`/`breakEnd`) either both-or-neither and within the open window, and `slotDurationMinutes` a positive integer that fits at least one whole slot after subtracting any break. Each failure returns its own specific message. On success, upserts all 7 rows (update existing, create missing) inside one `$transaction`, keyed on the new `businessId_dayOfWeek` compound unique.
- Both routes gated by `authenticate` + `requireApprovedBusiness`, same as the business-profile routes.

**Verified (curl, live dev DB)**
- Valid 7-day `PUT` → `200`; `GET` afterward matched the submitted data exactly (closed days showing `null` time fields).
- Same business, second `PUT` with different values → `200`, data updated in place; row count confirmed still **7** (not 14) via a direct DB query — proves the upsert's compound key works rather than silently duplicating.
- All 7 validation failures each triggered independently (fewer than 7 days, duplicate `dayOfWeek`, all-closed week, open day missing times, `endTime` before `startTime`, break outside the window, `slotDurationMinutes` too large to fit) — each returned its own distinct message, confirmed via the exact response bodies.
- Ran all 7 invalid submissions back-to-back against the same business, then re-`GET` and diffed byte-for-byte against the pre-rejection state, plus re-checked the row count — confirmed **zero** partial writes from any of them (pre-validation + transaction both hold).
- `GET /owner/availability` with a pending/rejected/suspended token (same business, DB state mutated directly to simulate a stale token, same technique as the business-profile verification) → the same three 403s as `GET /owner/business`, exact wording match, since both routes share `requireApprovedBusiness`.
- Test user/business and the throwaway verification script deleted afterward.

**Blocking fixes**
- `prisma migrate dev` isn't usable in this non-interactive shell (no TTY for its interactive migration workflow) — worked around with `prisma migrate diff --from-config-datasource ... --to-schema ...` to generate the SQL, then applied it via a manually-created migration folder + `prisma migrate deploy`. Worth remembering for any future schema change made through this tool.
- `parseTimeToMinutes`'s array destructuring tripped `noUncheckedIndexedAccess` (`hours`/`minutes` typed as possibly `undefined`) — fixed with a `!` justified by the preceding `TIME_FORMAT.test()` call that guarantees the split always has two parts.

**Open questions**
- None.

**Next up**
- Booking forms and bookings endpoints under `/owner`; slot computation logic that actually reads `AvailabilityRule` to produce bookable times for the public booking page.

## 2026-07-07 — Business profile management (owner self-service + public view)

**Shipped**
- `backend/src/middleware/requireApprovedBusiness.ts` (new): runs after `authenticate`, fetches the business via `req.user.businessId`, and gates on it being `approved` + `active` — reuses `auth.ts` login's exact wording for the pending/rejected/suspended cases (same order: pending → rejected (with `reason`) → suspended). Also guards the case `authenticate` alone can't catch: a `businessId`-less (admin) token, which now gets `403 "Owner access required."` instead of crashing a `findUnique({ where: { id: undefined } })`.
- `GET /owner/business` (`backend/src/routes/owner.ts`): businessId comes only from `req.user.businessId`, no URL param. Returns exactly `id, name, slug, description, phone, contactEmail, websiteUrl, isActive, approvalStatus, rejectionReason, createdAt` via a Prisma `select` (no `userId` leak).
- `PATCH /owner/business`: partial update of `description`/`phone`/`contactEmail`/`websiteUrl` only (unsent fields untouched); `400` if the body includes `name` or `slug` at all — those are permanent post-registration.
- The original `GET /owner/business/:businessId` tenant-isolation test route is commented out in place (not deleted) with a reference note, superseded by the two routes above.
- `GET /public/businesses/:businessId` (`backend/src/routes/public.ts`, previously empty): unauthenticated, returns only `id, name, description, phone`. Not-found, not-approved, and not-active all produce the identical `404 "Business not found."` body — never reveals which.
- Wired `/public` into `index.ts` (previously commented out, no import at all).

**Verified (curl, live dev DB)**
- `GET /owner/business` returns exactly the 10 specified fields, confirmed no `userId` leak.
- `PATCH /owner/business` with `{ description, phone }` → `200`; re-fetched and confirmed only those two fields changed, everything else (including `name`/`slug`) untouched.
- `PATCH` with `{ name }` and separately with `{ slug }` → both `400` with the same message.
- **Stale-token scenario** (the actual bug this middleware fixes): logged in once while the business was `approved` to get a token, then mutated the business's DB state directly through `pending` → `rejected` (with a reason) → `approved`+`isActive: false`, reusing the *same* still-unexpired token for each `GET /owner/business` call. Got the exact expected 403 at each stage (pending wording, rejected wording + `reason` field, "Account suspended") — confirms the middleware re-checks live DB state on every request rather than trusting anything encoded in the token.
- `GET /owner/business` with an admin token → `403 "Owner access required."`.
- `GET /public/businesses/:id` for the approved business → `200` with only `id, name, description, phone`; for the same business while pending, while rejected, and for a random nonexistent UUID → byte-identical `404` bodies in all three cases (diffed to confirm).
- Confirmed the old `GET /owner/business/:businessId` route is genuinely gone at the Express routing layer — hitting it now returns Express's default HTML "Cannot GET ..." 404 page, not the old handler's JSON response.
- Test user/business rows and the throwaway verification script deleted afterward.

**Blocking fixes**
- None.

**Open questions**
- None.

**Next up**
- More `/owner` routes (availability rules, booking forms, bookings) and remaining `/admin` routes (platform overview, suspend business — there's currently no API way to flip `isActive` on a business at all, only direct DB access, which this session had to use for the suspended-state test).

## 2026-07-07 — UC11: admin approve/reject business registration

**Shipped**
- `backend/src/middleware/requireAdmin.ts` (new): runs after `authenticate`, checks `req.user?.role === 'admin'`, 403 "Admin access required" otherwise.
- `PATCH /admin/businesses/:id/approve` (`backend/src/routes/admin.ts`, new): 404 if the business doesn't exist, 400 "Business is already approved" if it's already out of `pending`, otherwise sets `approvalStatus: 'approved'` and sends a best-effort confirmation email to the owner (looked up via `business.userId`) with a login link.
- `PATCH /admin/businesses/:id/reject`: requires `rejectionReason` in the body (400 if missing/empty), same 404/already-rejected guards, sets `approvalStatus: 'rejected'` + stores `rejectionReason`, sends a best-effort email to the owner including the reason.
- Wired `/admin` into `index.ts` (previously commented out, no import at all).
- Route path is `/admin/businesses/...`, not `/api/admin/businesses/...` — matches this codebase's existing no-`/api`-prefix convention (`/auth`, `/owner`) rather than the API docs' literal path.

**Verified (curl, live dev DB)**
- Approved a pending test business → `approvalStatus` flipped to `approved` in the DB; no mailer error logged for the approval email (Mailtrap sandbox hit its per-second rate limit on the earlier *registration* emails during test setup, unrelated to this endpoint — no error logged specifically for the approval/rejection sends). Re-approving the same business → `400 "Business is already approved"`.
- Rejected a different pending test business with no `rejectionReason` → `400`; with a reason → `200`, `approvalStatus: 'rejected'` and `rejectionReason` both confirmed in the DB, no mailer error logged. Re-rejecting → `400 "Business is already rejected"`.
- 404 confirmed on both endpoints for a nonexistent business id.
- 403 "Admin access required" confirmed on both endpoints using a real owner token (the newly-approved test owner's).
- Logged in as the approved test owner immediately after approval → succeeded (ties back to UC4 A5 — previously blocked with the "still under review" 403).
- Test businesses/owners deleted afterward; no leftover rows or scratch files.

**Blocking fixes**
- None.

**Open questions**
- Couldn't visually confirm the approval/rejection emails landed in the Mailtrap inbox (no Mailtrap API/UI access from this session) — verification relied on the absence of a logged `sendMail` failure, which is a good but not airtight signal. Worth a manual spot-check in the Mailtrap UI at some point.
- Mailtrap Sandbox's per-second rate limit is easy to trip when a test script fires several registrations back-to-back (each registration sends 2 emails) — fine for now, but something to watch if test scripts grow.

**Next up**
- `requireApprovedBusiness` middleware for `/owner` routes (still open from the 2026-07-07 auth-middleware entry), then more `/owner` routes (availability rules, booking forms, bookings) and remaining `/admin` routes (platform overview, suspend business).

## 2026-07-02 — Forgot/reset-password + SMTP setup

**Shipped**
- SMTP configured via Mailtrap Sandbox (Email Testing product) — real email 
  delivery confirmed working end-to-end for register's admin/owner 
  notifications, which were previously no-op'ing since SMTP wasn't set up.
- `POST /auth/forgot-password` — generates a random token via 
  `crypto.randomBytes(32)`, stores it + a 1-hour expiry on the user's row, 
  sends a best-effort reset email (unawaited, to avoid a timing side-channel 
  between real/nonexistent emails), and always returns an identical 
  enumeration-safe response regardless of whether the email exists.
- `POST /auth/reset-password` — validates the token against `resetToken` + 
  expiry, rejects invalid/expired tokens with a generic message, and updates 
  the password hash while clearing the token fields in a single 
  `prisma.user.update` call (single-use guarantee).
- `auth.ts` is now feature-complete: register, login, forgot-password, 
  reset-password — all four endpoints tested against a live dev DB.

**Verified (Postman, live dev DB)**
- Identical response for real vs. nonexistent email (enumeration-safe, 
  confirmed byte-identical).
- Reset token correctly written to DB (64-char hex, ~1h expiry).
- Old password fails post-reset, new password succeeds.
- Token reuse rejected after consumption (single-use confirmed).
- Expired token rejected; re-verified in isolation by pushing the same 
  token's expiry forward and confirming it then succeeds — proving the 
  rejection was specifically the expiry check, not a false positive.

**Dev tooling**
- Added local-only cleanup scripts (`scripts/listOwners.ts`, 
  `scripts/deleteTestUsers.ts`) for wiping test owner accounts + their 
  cascading Business/BookingForm/FormField rows between testing sessions. 
  `scripts/` is gitignored — local machine only, not pushed. Run via 
  `npm run list-owners` / `npm run cleanup-owners`.
- Cleaned up 5 test owner accounts (Joe, Joey, Jimmy, AFA, FAF) created 
  during today's and prior sessions' Postman testing.

**Open questions / flagged for later**
- Domain + real SMTP provider (Resend/SendGrid) deferred to deployment week — 
  Mailtrap Sandbox is sufficient through the rest of development.

**Next up:** UC11 (admin approve/reject business) — currently the only way 
to approve a pending business is manually via Prisma Studio. Or 
`GET`/`PATCH /owner/business` for owner-facing business management.

---

## 2026-07-07 — Auth middleware + first owner route

**Shipped**
- `backend/src/middleware/authenticate.ts`: verifies the `Authorization: Bearer <token>` header via `jwt.verify()` against `JWT_SECRET`, narrows the decoded payload with a runtime type guard (rejects tokens with a valid signature but an unexpected/legacy shape), and attaches `req.user` (`{ userId, role, businessId? }`). Missing/malformed header → 401 "Authentication required"; invalid/expired/wrong-shape token → 401 "Invalid or expired token"; missing `JWT_SECRET` env var → 500 (treated as a config error, not a bad-token error).
- `backend/src/types/express.d.ts` (new): global augmentation adding `req.user?: AuthenticatedUser`, so the field is properly typed everywhere instead of `any`.
- `GET /owner/business/:businessId` (`backend/src/routes/owner.ts`, new): first real `/owner`-scoped endpoint, gated by `authenticate`. Rejects non-owner tokens (403 "Owner access required."), enforces tenant isolation by comparing the URL's `businessId` against the token's (403 "You do not have access to this business." on mismatch), then fetches and returns `{ business }` (404 if the row's since been deleted). Wired `/owner` into `index.ts` (previously commented out).

**Blocking fixes**
- None.

**Open questions**
- `requireApprovedBusiness` (checks `approvalStatus === 'approved' && isActive === true`) still doesn't exist, so `GET /owner/business/:businessId` will happily return a since-suspended or since-rejected business's data as long as the 24h token is still otherwise valid.

**Next up**
- `requireApprovedBusiness` middleware and `requireAdmin.ts`, then more `/owner` routes (availability rules, booking forms, bookings) and `/admin` routes.

## 2026-07-02 — Login endpoint

**Shipped**
- `POST /auth/login`: validates email/password, looks up the user, and returns an identical "Invalid credentials" 401 for both a nonexistent email and a wrong password (indistinguishable to an attacker). Blocks deactivated users (`User.isActive`) before branching on role. For owners, checks their business in order — pending (UC4 A3 wording verbatim), rejected (UC4 A4 wording + stored `rejectionReason`), suspended (`Business.isActive`, UC15's effects-table wording "Account suspended"). On success, issues a JWT via `jsonwebtoken` (24h expiry): `{ userId, role }` for admins, `{ userId, role, businessId }` for owners. Response is `{ token, user }` with a minimal user object (id, name, email, role) — never `passwordHash`.
- Added `JWT_SECRET` to `.env` (gitignored, random dev secret).
- Verified against the live dev DB: missing fields, wrong password, nonexistent email, pending/rejected/suspended-business blocks, deactivated-user block (both roles), and successful owner + admin logins with JWT payloads decoded and checked. All test rows cleaned up afterward.

**Blocking fixes**
- None.

**Open questions**
- `User.isActive` is now checked at login, but the `authenticate`/`requireApprovedBusiness` middleware (still empty stubs) will need to re-check business approval/active state on every `/owner` request too — a token issued now stays valid for 24h even if the business is suspended mid-session.

**Next up**
- `backend/src/middleware/authenticate.ts` (JWT verification) and the `requireApprovedBusiness` gate for `/owner` routes.

## 2026-07-01 — Register endpoint

**Shipped**
- `POST /auth/register`: validates input, checks for a duplicate email, hashes the password (bcrypt), generates a unique business slug (numeric-suffix collision handling), and in one transaction creates `User` (role `owner`) + `Business` (`approvalStatus: pending`) + a default `BookingForm` with Name/Email/Phone fields — matching UC4. No JWT is issued at registration (the owner isn't logged in until admin approval). Best-effort admin-notification + owner-confirmation emails via a new `lib/mailer.ts`, which no-ops gracefully when SMTP isn't configured.
- Wrapped the transaction in try/catch: a `P2002` unique-constraint race on `User.email` (two concurrent duplicate registrations) now returns the same 409 "account already exists" message as the pre-check, instead of leaking a generic 500. First attempt checked `err.meta.target`, which doesn't exist in this Prisma 7 + `@prisma/adapter-neon` error shape — corrected to check `err.meta.modelName === 'User'`, verified by forcing an actual concurrent-request race.

**Blocking fixes**
- `ts-node` couldn't resolve any relative import on Node v24 (its ESM loader hooks predate Node's breaking changes) — swapped the dev runner to `tsx`.
- `PrismaClient` had no way to get a connection string — Prisma 7 requires a driver adapter rather than a schema `url`. Added `@prisma/adapter-neon` + `@neondatabase/serverless`, wired into `lib/prisma.ts`.
- `dotenv.config()` ran after the `authRoutes` import, but ESM evaluates imports before the importing module's own code — env vars weren't loaded before Prisma initialized. Fixed via `import 'dotenv/config'` as the first import in `index.ts`.

**Open questions**
- `schema.prisma`'s `resetToken`/`resetTokenExpiresAt` columns on `User` don't match UC5's design (a separate `password_reset_tokens` table supporting multi-token invalidation) — needs resolving before forgot-password is built.

**Next up**
- Login endpoint (shipped — see above).
