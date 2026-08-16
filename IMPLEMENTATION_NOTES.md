# Orbis Scheduler — Implementation Notes: Plan vs. Reality

This document exists because a lot of real engineering happened *between* the specs and the shipped product that isn't captured anywhere in one place. `docs/Orbis_Scheduler_Frontend_Specification.pdf`, `docs/Orbis_Scheduler_Design_Specification.pdf`, the use-case docs, and the API endpoint reference describe the *intent*. `docs/DEVLOG.md` has the session-by-session *record*, but it's long, chronological, and (as of this writing) partially damaged — see [§6](#6-repo-hygiene-issue-found-while-writing-this-document). This document is the synthesis: what the docs said, what actually got built, why it diverged where it diverged, and what was knowingly left undone.

It draws on `docs/DEVLOG.md`, `docs/FUTURE_IMPROVEMENTS.md`, `CLAUDE.md`, the git history, and a direct read of the current codebase.

---

## 1. Status snapshot

- **Backend**: feature-complete. 30 endpoints (not 29 — see [§3](#3-doc-corrections-the-docs-themselves-got-out-of-date)) across `/auth`, `/public`, `/owner`, `/admin`. Matches the original design closely; most divergence is *resolving ambiguity the docs left open*, not deviation from intent.
- **Frontend**: every screen in the spec's build order is built and wired to the real API — auth (login/register/forgot/reset), the public booking page, the full owner dashboard (home, bookings list + detail, availability, form builder, share & embed, settings), and all three admin screens (overview, business list, business detail) — plus `widget.js`, the embeddable popup-modal script, built 2026-08-12. Every piece of the original frontend spec's scope is now shipped.
- **`CLAUDE.md`'s frontend section is stale.** It currently reads "Frontend is scaffolded but has no screens yet" — true as of 2026-07-31, not true since. Worth a follow-up edit; not done as part of this document since it's a statement of fact about the repo, not history.

---

## 2. Backend: where the docs were ambiguous, wrong, or silent

The backend was built first and mostly matches its own design docs. The interesting parts are the handful of places where a use case (UC) doc, the API reference, or the task brief either contradicted itself, contradicted the actual codebase convention, or simply didn't say — each of these was a real decision, not an oversight.

- **404 vs. 403 for cross-tenant access.** UC9's alternate flow A3 says a business hitting another tenant's booking should get `403 Forbidden`. The task brief's own design principles said the opposite. Resolved by tracing git history: the only place this codebase ever used `403` for a tenant mismatch was a draft route deleted in the very next commit; the live precedent (`PATCH`/`DELETE /form/fields/:id`) uses `404`. Went with `404` everywhere — it's also the stronger choice, since a `403` confirms a resource exists on another tenant and a `404` doesn't.
- **Anti-enumeration collapsing.** UC1's alternate flows A1–A4 imply three distinguishable messages for a nonexistent / pending / rejected / suspended business. The shipped behavior is one identical `404 "Business not found."` for all four, deliberately — the whole point is that a customer (or attacker) can't learn a business exists at all. Same principle applied to `GET /owner/business/:businessId`'s old test route, `POST /public/bookings`, and `GET /public/slots`.
- **One "slot taken" message, not the two the use cases quote.** UC2 A3 and UC3 A1 each specify different wording for the same double-booking race. The shipped code returns one string, `"This slot was just taken. Please select another time."`, on both the optimistic pre-check and the real DB-constraint race path — deliberately, so a genuine race and an already-taken slot are indistinguishable to the client.
- **The partial-unique-index race fix.** The optimistic "is this slot free" check alone cannot close a real concurrency race — two near-simultaneous requests can both pass it before either writes. The actual fix is a Postgres **partial (filtered) unique index** on `bookings ("businessId", "bookingDate", "bookingTime") WHERE status IN ('pending','approved')`, hand-written as raw SQL because Prisma's schema language has no `WHERE`-clause syntax for `@@unique`. It's invisible to `schema.prisma` and only exists in its migration file — flagged explicitly as a new kind of drift for this codebase, confirmed with the team before writing any code, and proven under real concurrent-request tests (not just reasoned about).
- **`isProtected` became a real column mid-build.** It started as `field.label === 'Name' || 'Email'` string matching — fragile the moment a field could be renamed. Replaced same-session with a real `FormField.isProtected` boolean column, set explicitly at registration. Known, accepted gap: businesses registered before that migration have `isProtected: false` on all fields, including Name/Email, with no backfill (confirmed directly against real leftover test data, not just asserted).
- **Admin's "this week" is a rolling 7-day window, not the calendar week** — deliberately not reusing the `AvailabilityRule.dayOfWeek` Monday=0 convention, since a trailing activity metric shouldn't reset to near-zero every Monday morning.
- **`GET /admin/me` was added late**, after the original 7 admin routes, because none of them returned the logged-in admin's own name/email — needed once the admin sidebar needed an identity block, the same way the owner sidebar already showed `owner.email`. This is the 30th backend route and the reason the endpoint count in older docs (27, then 29) keeps drifting — see [§3](#3-doc-corrections-the-docs-themselves-got-out-of-date).
- **`GET /owner/bookings`'s `counts` object** (`{ pending, approved, rejected, cancelled, all }`) was added specifically to fix a UI bug: the five filter pills on the owner bookings screen would otherwise zero out every pill except the active filter. `counts` is computed via a separate, status-blind `countsWhere` so filtering to "pending" still shows real numbers on the other four pills. First use of Prisma's `groupBy` in the codebase.

---

## 3. Doc corrections: the docs themselves got out of date

These aren't implementation gaps — they're places where a use case doc or the API reference no longer describes what the shipped, intentional behavior is. Carried over from `docs/FUTURE_IMPROVEMENTS.md`, consolidated here because they came up repeatedly while building the frontend against those same docs:

| Doc | What it says | What actually ships | 
|---|---|---|
| UC9 A3 | Cross-tenant booking access → `403 Forbidden` | `404`, everywhere, deliberately (anti-enumeration) |
| UC1 A1–A4 | Three distinguishable messages for a bad/pending/rejected/suspended business | One identical `404` for all four |
| UC2 A3 / UC3 A1 | Two different quoted strings for the same slot-race event | One string: `"This slot was just taken. Please select another time."` |
| UC2 A2 | `"Invalid value for [field label]"` | `"${field.label} must be one of the provided options"` |
| UC10 | Section B is an "iframe HTML snippet" | A `<script>` tag opening a modal overlay (per the frontend spec's own decision 6) — a plain iframe gets squeezed by whatever layout surrounds it |
| API endpoint reference | Header says "27 routes"; the table sums to 29; frontend spec cites 29 | Real total is **30** (`GET /admin/me` was added after both documents were written) |

None of these were corrected in the binary `.docx`/PDF source documents (no editable source exists in this repo for them) — `CLAUDE.md` and `docs/FUTURE_IMPROVEMENTS.md` carry the corrections instead.

---

## 4. Frontend: screen-by-screen, what changed and why

Built in the frontend spec's own recommended order. Each entry below is a real decision made while building that screen, not a cosmetic note — full session detail lives in git history if a deeper trace is ever needed (`git show b8d9e00:docs/DEVLOG.md`, see [§6](#6-repo-hygiene-issue-found-while-writing-this-document)).

**Scaffold & design system** — Tailwind v4's config lives entirely in `globals.css` (no `tailwind.config.ts`), which is a v4 platform fact, not a choice. shadcn/ui components are copied into the repo, not installed, per decision made early so `button.tsx` could be customized (radius forced to `rounded-sm`, off-scale text size corrected) without fighting an upstream package.

**Auth screens (login/register/forgot/reset)** — built directly against `POST /auth/*`, no deviation of note.

**Owner dashboard shell** — session is a `jsonwebtoken`-verified `httpOnly` cookie, checked in the `(owner)/layout.tsx` **Server Component**, not Next middleware — middleware's edge runtime can't run `jsonwebtoken`, and a second verification library would drift from the backend's own `authenticate.ts`. A `403` from `requireApprovedBusiness` (pending/rejected/suspended business) renders a full-page blocked-status screen with the backend's own wording verbatim, rather than a broken dashboard behind a working shell.

**Bookings list + detail** — the counts-pills backend fix above was driven directly by building this screen. The detail screen's toast/confirm-dialog system was hand-built on `@base-ui/react` (already a dependency) rather than pulling in `sonner`, since Base UI was already in the tree for `button.tsx`.

**Availability screen** — the first screen using `react-hook-form` + `zod` (frontend spec decision 15 reserves that combination for the two genuinely complex forms: this one and the form builder). `PUT /owner/availability` turned out to expect a bare array where `GET` returns a wrapped object — asymmetric, confirmed by reading the route rather than trusting the task brief's guess. A new business with no saved `AvailabilityRule` rows defaults every day to **closed**, not a pre-filled starter week — a decision confirmed with the team before building, not assumed.
  - Follow-up polish pass fixed two real, silent bugs: invalid `Select` fields had no visible red border (the `aria-invalid` attribute the shadcn trigger already supported just wasn't being passed), and an invalid submit produced inline errors with no other feedback at all — fixed with `onInvalid` firing a toast.
  - **A deliberate, documented deviation from the Design Specification**: toast position was moved from the spec's stated bottom-right (desktop) to top-right, because bottom-right sat directly over the primary action button someone had just clicked. There's no editable source for the Design Spec PDF in this repo, so this note is the permanent record of that drift.

**Form Builder** — reading the actual `PATCH /form/fields/:id` route revealed `fieldType` is immutable after creation (400s if present in the body) — not mentioned in the task brief, discovered by reading the code, and reflected in the UI (the Type selector disables itself once editing an existing field). Reorder uses `dnd-kit`, newly added to the dependency tree — nothing drag-related existed before this screen. Neither UC8 nor the frontend spec specifies exact toast copy for field add/edit/delete; that wording is invented, flagged as such.

**Share & Embed** — the public origin (`http://localhost:3000` in dev, the real domain in production) is derived from the incoming request's `headers()` rather than a new env var, since none existed and inventing one risked drifting from wherever the app actually deploys. The embed code-block is the **one sanctioned exception** to "never write a raw colour value" — it's meant to read as a fixed dark code-editor surface regardless of the app's own theme, confirmed with the team before building. "Test booking page" deliberately diverges from UC10's literal telling: UC10 has the *public page itself* show the "no availability" message, but the public page didn't exist yet when this screen was built, so the check was moved here instead (an on-click `GET /owner/availability` call with a dismissible banner).

**Settings (Business Profile)** — built at `/dashboard/settings`, not the frontend spec's literal `/dashboard/profile`; the actual route was already established by the sidebar/nav from the earlier shell session, and that (not the spec's route name) is what got trusted. Business name and the booking URL are genuinely `disabled` inputs — verified via `.isDisabled()` in browser testing, not just styled to look disabled.

**Dashboard Home — a reversed decision.** The original plan was to skip a dedicated home screen and redirect `/dashboard` straight to the bookings list. That decision was later reversed: `/dashboard` now renders a real landing screen (greeting, stat cards, recent bookings, a setup-status nudge). Both the original call and the reversal are preserved in devlog history rather than silently overwritten, since a later session shouldn't have to guess why a redirect existed if it ever needs revisiting.

**Cross-screen consistency fixes** — three bugs found by auditing all six owner screens together rather than one at a time: a shared `<main>` flex-context bug that made every route-transition spinner render pinned to the top of the page instead of centered; a header-spacing inconsistency across six screens (three different effective gaps, one of them a genuine CSS margin-collapsing bug, not just inconsistent values); and a whole-page-scroll bug where a content-heavy page scrolled the entire viewport (sidebar included) instead of just the content column.

**Public Business Booking Page** — the largest single screen, and per the frontend spec itself "the highest-value screen in the whole product." A few things stand out:
  - The dropdown/radio/checkbox fields were originally built as a pill-based selector, then **redesigned in a follow-up session** to a real `Select` trigger and native radio/checkbox inputs — better keyboard/screen-reader semantics, reusing the same `Select` component the Availability screen's time pickers already used.
  - **A real, shipped security/data-quality gap was found and fixed here**: `POST /public/bookings` had zero email-format validation on either the client or the server, discovered from actual junk data ("X Y Z") in a real test business's bookings. Fixed on both sides with the same regex `auth.ts`'s registration endpoint already used — one consistent standard instead of registration having a check and bookings having none.
  - **This page briefly shipped with zero dark-mode support at all** — not a flash-of-wrong-theme bug, a complete absence of theme detection, because the app's only dark-mode logic lives in a hook that has to be called by some mounted component, and nothing on this deliberately headerless/sidebarless page called it. Fixed with a blocking inline script that reads the theme before hydration paints — the page intentionally only follows OS preference here, no manual toggle, since there's no natural chrome slot for one.
  - The custom "time wheel" picker's glass effect originally blurred the *centered, selected* time — backwards from the iPhone-style magnifier effect it was meant to imitate. Fixed by dropping the blur and keeping only the scale/saturation effect.

**Admin screens (Overview, Businesses list, Business Detail)** — the last, lowest-priority tier, deliberately built last per the spec's own recommended order. The admin sidebar/mobile-nav are a **deliberate duplication** of the owner shell's structure, not a shared abstraction — 2 nav items vs. 6, no business-switcher, different identity block. Noted as an intentional two-consumers-isn't-worth-abstracting call, not an oversight. `GET /admin/me` (see [§2](#2-backend-where-the-docs-were-ambiguous-wrong-or-silent)) was added specifically to support this screen's identity block.

---

## 5. Known gaps — deliberately deferred to future work

Consolidated from `docs/FUTURE_IMPROVEMENTS.md`. These are documented trade-offs made to hit the trimester deadline, not bugs.

**Availability & Scheduling**
- No seasonal or date-ranged availability — one fixed recurring weekly template only, no way to set different hours for a holiday period.
- `PUT /owner/availability` doesn't return a count of existing bookings that now fall outside newly-saved hours (UC7 A4's specified save-time warning). The frontend screen was built without this warning since the backend has nothing to show yet.

**Admin & Platform**
- No audit log of who approved/rejected/suspended a business, or when.
- `users.is_active` (per-account login deactivation, distinct from business suspension) exists in the schema but has no admin endpoint anywhere — dead schema today.
- `GET /admin/stats` only offers two fixed windows (all-time, rolling 7-day) — no selectable date range.
- No suspension-notification email to business owners — silent by design per the use case doc, but flagged as a possible future addition.

**Registration & Trust**
- No email verification at registration, no CAPTCHA, no business identity/ABN-ACN verification before approval.

**Email infrastructure**
- Still on Mailtrap Sandbox, not a real SMTP provider/domain — planned for deployment time.
- Plain-text emails only, no HTML templates.

**Performance**
- `Booking` has no index beyond its primary key, despite the owner bookings list filtering/sorting on `businessId`/`status`/`createdAt`. Fine at current data volume, flagged before real load.
- `booking_field_values` duplicates the Name/Email/Phone values that already exist as dedicated `bookings` columns — deliberate per UC3 (a full field-by-field record including protected fields), not a bug.

**File uploads & storage**
- Logo upload (Business Profile) and file-type booking-form fields both require real object storage (S3/R2 or similar) plus a new multipart upload endpoint — neither is a variation on the existing PATCH pattern, both are genuinely new infrastructure, both deferred past the trimester deadline.

---

## 6. Repo hygiene issue found while writing this document

While reconstructing the frontend build history for this document, `docs/DEVLOG.md` turned out to be in a broken state worth flagging directly:

- The file currently contains **unresolved git merge-conflict markers** (`<<<<<<< HEAD`, `=======`, `>>>>>>>`) committed straight to `main` — visible at the top of the file today.
- The most recent commit touching it, `ee0b727` ("devlog updated"), didn't resolve that conflict — it **deleted roughly 450 lines** of real session history (net −436 lines) while leaving the conflict markers in place. The entries lost from the committed file include the sessions for the admin screens, the public booking page (and its email-validation and dark-mode fixes), the availability screen, the form builder, Share & Embed, Settings, and Dashboard Home — all real, already-shipped work with no committed record left of *how* or *why* it was built.
- That history is **not actually gone** — it's recoverable from git at commit `b8d9e00` (`git show b8d9e00:docs/DEVLOG.md`), one commit before the deletion. This document was written using that recovered version as a source, which is how the detail in [§4](#4-frontend-screen-by-screen-what-changed-and-why) above was reconstructed.

This is worth fixing properly — restoring the fuller history and resolving the conflict markers for real — rather than leaving `docs/DEVLOG.md` in its current, actively-broken state. Happy to do that as a follow-up if wanted; it wasn't done as part of this document since it's a separate, deliberate edit to a different file.

---

## 7. Quick facts

- **30** backend endpoints across `/auth`, `/public`, `/owner`, `/admin` (not the 27 or 29 older docs cite).
- **16** frontend screens shipped across the 3 route groups — public (landing, login, register, forgot/reset password, the public booking page), owner (dashboard home, bookings list, booking detail, availability, form builder, share & embed, settings), admin (overview, business list, business detail) — plus `widget.js`, shipped 2026-08-12. The original frontend spec's scope is now fully built.
- Frontend dependencies added along the way, beyond the initial scaffold: `react-hook-form` + `zod` + `@hookform/resolvers` (availability, form builder), `@dnd-kit/*` (form builder reordering), `qrcode.react` (Share & Embed), `react-day-picker` (public booking calendar), `date-fns`.
