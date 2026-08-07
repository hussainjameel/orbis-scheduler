# Orbis Scheduler — Development Log

## 2026-08-04 — Availability screen fixes: field-error borders, validate-on-click, toast position, 3-up grid

**Shipped**
- `day-card.tsx`: every `Select` field driven by `fieldState.error` (Start/End time, both break selects, slot duration) now gets `aria-invalid={Boolean(...)}` passed through to its `SelectTrigger`. `select.tsx`'s trigger already ships `aria-invalid:border-destructive` (plus `dark:` opacity variants) from the shadcn base — it just wasn't being told a field was invalid, so only the message text was ever visible, not the border the design spec's Input states table calls for. `--destructive` resolves to `--status-rejected-text`, which is redefined under `.dark`, so this is dark-mode-correct without any extra work.
- `availability-form.tsx`: `form.handleSubmit(onSubmit)` → `form.handleSubmit(onSubmit, onInvalid)`, where `onInvalid` fires `toast.error("Fix the highlighted fields before saving")`. Uses react-hook-form's own built-in invalid path rather than a second manual validity check. The Save button was never actually disabled by validity (only by `submitting`) — the real gap was silence: an invalid click populated inline errors with zero other feedback.
- `components/toaster.tsx`: desktop toast position moved from bottom-right to top-right (`sm:top-4 sm:right-4 sm:bottom-auto`, mobile unchanged — still bottom, full width, below `sm`). **Deliberate deviation from the written Design Specification**, which documents "bottom-right on desktop." Reason: bottom-right sat directly over/near the page's primary action button — the exact button someone just clicked — so the toast and the next click target competed for the same screen area. There is no editable source for the Design Specification PDF in this repo (no `.docx`/Figma equivalent, only the checked-in PDF), so this entry is the documented record of the drift per the same discipline that caught the UC9/404-vs-403 wording mismatch — flag it here rather than let it go unrecorded. Also flipped the entrance animation to `slide-in-from-top-2` at `sm:` and up (mobile keeps `slide-in-from-bottom-2`), since sliding "from bottom" into a top-anchored toast looked backwards.
- `availability-form.tsx` + `day-card.tsx`: grid changed from a flat `grid-cols-2` to `grid-cols-1 sm:grid-cols-3` (1-up mobile, 3-up desktop) — `sm` confirmed as this app's one established mobile/desktop cutoff (`layout.tsx`, `owner-sidebar.tsx`, `owner-mobile-nav.tsx`, `register-form.tsx` all use it; no existing 3-column precedent anywhere, so no new breakpoint was invented). Day name (`text-base` → `sm:text-sm`), the four row labels ("From"/"To"/"Break"/"Slot", `text-sm` → `sm:text-xs`), and the Select triggers' own text (`sm:text-xs` added) all step down one notch on the type scale at the same breakpoint, to keep the narrower 3-up cards from wrapping. The "Available"/"Closed" label stayed at `text-xs` — already the smallest defined size, so it has nowhere lower to go.

**Verified**
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean after all four changes.

**Blocking fixes**
- None.

**Open questions**
- None recorded from this session.

**Next up**
- Business Profile and Form Builder remain the unbuilt owner-area screens.

## 2026-08-04 — Availability screen

**Shipped**
- `frontend/src/app/(owner)/dashboard/availability/page.tsx` (Server Component) + `availability-form.tsx` (Client Component) + `day-card.tsx`: the weekly availability grid, the first screen built on the react-hook-form + zod combination frontend spec decision 15 reserved for it. Two-column grid of 7 day cards (`GET /owner/availability`, which returns `{ availability: [...] }` — confirmed by reading `backend/src/routes/owner.ts` rather than assumed, since the task brief guessed a bare array); each card is an Open/Closed `Switch` plus, when open, From/To/Break/Slot rows built from `useFieldArray` over a single `days` array.
- `frontend/src/lib/availability.ts`: types, the 15-minute time-option list and `hh:mm AM/PM` formatter (pure integer math on `HH:MM` strings, never `Date`, per decision 14), and the zod schema. The schema mirrors the PUT route's own validation order (`backend/src/routes/owner.ts:139-190`) so client errors round-trip before the server does, and reuses UC7's exact alternate-flow copy: "You must have at least one open day for customers to book." (A1), "End time must be after start time" (A2), and a templated "A {N} min booking won't fit in your {start}-{end} window for {Day}. Either extend the day or shorten the duration." (A3). Break-window messages aren't given exact copy in UC7, so those are written in the same plain tone rather than invented as something new-sounding.
- `PUT /owner/availability` turned out to expect a **bare array**, asymmetric with GET's wrapped shape — the request body is sent as `values.days` directly, not re-wrapped.
- `AvailabilityRule` rows are only created on first save (nothing seeds them at registration), so a new business's `GET` can return fewer than 7 rows. `fillWeek()` pads any missing `dayOfWeek` with a closed default (`isAvailable: false`, placeholder 09:00–17:00/30 min held in reserve for when the owner opens that day) rather than inventing an open schedule.
- Post-save resync avoids manually patching form state (decision 1): `useForm`'s `values` option is passed the Server Component's fresh prop directly, with `resetOptions: { keepDirtyValues: false }`, so calling `router.refresh()` after a successful `PUT` re-fetches on the server and the new prop flows straight through to reset the form — no `form.reset()` call needed.
- Added `select.tsx` and `switch.tsx` via `npx shadcn@latest add` (Base UI primitives, matching `alert-dialog.tsx`'s existing pattern). No `form.tsx` exists in this project's shadcn registry (`base-nova` style) — checked directly (`npx shadcn add form` returns nothing, and no "form"/"field" entry appears in the full component list) — so the form uses `react-hook-form`'s `useForm`/`Controller`/`useFieldArray` directly rather than a shadcn Form wrapper that was never available. `react-hook-form`, `zod`, and `@hookform/resolvers` added to `package.json` — none were installed before this screen.
- Corrected two token names against the task brief's literal (and wrong) guesses: `border-border` doesn't exist in `globals.css` — the real class is `border-border-default`; `text-secondary`/`text-muted` are actually `text-text-secondary`/`text-text-muted` (prefixed), confirmed by grepping the existing bookings screens rather than trusting the brief.

**Verified**
- `npx tsc --noEmit`, `npm run lint`, `npm run build` all clean.
- No warning banner was built for UC7 A4 (existing bookings falling outside new hours) — confirmed by reading the PUT route's success response, which is only `{ message }`, no count of any kind. Logged as a gap in `docs/FUTURE_IMPROVEMENTS.md` rather than faking the UI against data that doesn't exist.
- Live-verified against the real dev DB rather than just the build: registered a throwaway business via `POST /auth/register`, approved it directly via `setApprovalStatus.ts`, logged in through the real `/api/auth/login` route to get a genuine httpOnly session cookie, then fetched `/dashboard/availability` with that cookie — confirmed the empty-availability new-business case renders all 7 days closed with no server error. Then `PUT` a realistic payload (Monday/Tuesday open with different break/slot configurations, rest closed) through the actual `/api/[...path]` proxy and re-fetched the page — confirmed the save persisted and the two open days' calendar icons picked up `text-brand` while the other five stayed muted, proving the `isAvailable`-driven styling and the GET→fill→render round trip both work end to end. All test data (business, user, form, availability rows) deleted afterward via a throwaway gitignored script; "AF Architects" untouched.
- Could not click through the actual Switch/Select interactions or the client-side validation/toast/refresh flow in a real browser — no browser-automation tool was available in this environment (only `WebFetch`, which can't execute JS or hold a session). The verification above covers the full server round trip and initial render in both the empty and populated states; the purely client-side interaction path (toggling, selecting, inline validation errors, submit toast) is unverified beyond code review and the `zod` schema's own logic.

**Blocking fixes**
- None.

**Open questions**
- None recorded from this session — the one open question (default state for a day with no saved rule) was resolved with the user before implementation: closed, not a pre-filled starter week.

**Next up**
- Business Profile and Form Builder are the remaining unbuilt owner-area screens from the spec's build order.

## 2026-08-03 — Owner booking detail screen + client mutation proxy

**Shipped**
- `backend/src/routes/owner.ts`: `GET /owner/bookings/:id`'s `fieldValues` select widened to include the parent `form_field`'s `fieldType` and `options` alongside `label`/`value` — no migration, no other response fields changed.
- `frontend/src/app/api/[...path]/route.ts`: the generic client-mutation proxy promised by frontend spec decision 9, built now because approve/reject/cancel are the first mutations this app has needed from a Client Component. Reads the httpOnly `token` cookie server-side (browser `fetch` can't), forwards method/body/query string to the Express API, returns the backend's response as-is — deliberately does **not** redirect on `401` the way `apiFetch` does, since a redirect here would hand the browser HTML instead of JSON; a `401` just passes through for the caller to handle. Next.js resolves the existing static `/api/auth/*` routes ahead of this catch-all automatically, no special-casing needed.
- `frontend/src/lib/api-client.ts`: client-side counterpart to `apiFetch` — can't share that module directly since it imports `next/headers`, which can't be bundled into a Client Component. Calls go through the new proxy.
- Toast + confirm-dialog scaffolding added on `@base-ui/react` (already a dependency, same package `button.tsx` uses) rather than pulling in `sonner`: hand-written `components/ui/alert-dialog.tsx`, `lib/toast.ts` (a module-level `Toast.createToastManager()` singleton so any Client Component can fire a toast without prop-drilling), and `components/toaster.tsx`. Mounting required a small `components/toast-provider.tsx` client wrapper — a Server Component (`app/layout.tsx`) can't pass the manager object as a prop directly into a Client Component's `<Toast.Provider>`, since RSC props must serialize and the manager is a bag of functions; the first build attempt failed prerendering with exactly that error.
- `frontend/src/app/(owner)/dashboard/bookings/[id]/page.tsx` (Server Component) + `booking-actions.tsx` (Client Component): the booking detail screen — customer card, submitted-answers card (per-`fieldType` rendering: text/textarea as plain text, dropdown/radio as a single pill, checkbox split on `", "` into multiple pills), status-gated owner notes + actions (pending → Reject/Approve; approved → Cancel behind an `AlertDialog` confirm; rejected/cancelled → no action row). On success, a toast fires and the page redirects to `/dashboard/bookings?status=<returnStatus>` — the status filter the owner had open when they clicked in, threaded through as `?from=` on the list page's links (added this session), since the detail route otherwise has no way to know which filter to return to.
- Failure path renders a **persistent inline banner**, not a toast (`role="alert"`, the same treatment already established in `login-form.tsx`) — per decision 5, toasts are for outcomes, not for validation/failed-load messages a user needs time to read.
- `components/status-badge.tsx` extracted from the badge markup that was previously inlined twice in `bookings/page.tsx`; date/time/relative-time formatters lifted from that same file into `lib/bookings.ts` so the detail screen doesn't duplicate them.
- Restored `docs/DEVLOG.md`: the immediately-prior commit (`1d4dfe3`) had wiped the entire file to empty, apparently from a merge conflict resolved by deletion rather than merge (the pre-wipe version still had unresolved `<<<<<<< HEAD` markers around two separate 2026-08-03 entries). Recovered the full prior history from git, re-merged the two conflicted entries back in chronological order, and added this entry on top.

**Verified**
- `npm run build` and `npm run lint` (frontend) clean; `npx tsc --noEmit` (backend) clean other than one pre-existing, unrelated error in a gitignored dev script.
- Live-clicked the actual flow in a real browser (Playwright driving headless Chromium — no `chromium-cli` available on this Windows environment, so the local dev server was driven directly): registered a throwaway test owner + business + form fields (one of each `fieldType`) + a pending and an approved booking via Prisma, logged in through the real login form, then: viewed the pending detail (all five customer fields, all five submitted-answer render styles, editable notes textarea, Approve/Reject visible), typed a note and approved it — toast appeared, redirected to `?status=pending` with the pending count now at 0; opened the approved booking, opened the cancel confirm dialog, confirmed — toast appeared, redirected to `?status=approved`, badge read Cancelled and the owner-notes card correctly disappeared (no notes had been set); hit a nonexistent booking id and got Next's default not-found page inside the dashboard shell; toggled `.dark` on a detail page and re-checked layout. Zero console errors throughout. All test data and the throwaway seed/cleanup scripts deleted afterward.

**Blocking fixes**
- None.

**Open questions**
- None recorded from this session.

**Next up**
- Business Profile, Availability, and Form Builder screens are still the largest unbuilt pieces of the owner area — the booking detail screen was next in the spec's build order after the list.

## 2026-08-03 — `GET /owner/bookings`: status `counts` for filter pills

**Shipped**
- `GET /owner/bookings` (`backend/src/routes/owner.ts`) now returns a `counts: { pending, approved, rejected, cancelled, all }` object alongside the existing `bookings`/`total`/`page`/`totalPages`, so the frontend can populate all five filter pills from one call instead of five.
- `counts` is produced by a single `prisma.booking.groupBy({ by: ['status'], ... })` — the first use of `groupBy` in this codebase — reduced into a fixed-shape object seeded with all four statuses at `0` so a status with no rows still appears as `0`, never an absent key. `all` is the sum of the four, computed in code rather than trusting the DB to return a total row.
- The search condition (`customerName`/`customerEmail` case-insensitive `contains`) was factored out of `where` into a shared `searchFilter`, reused by both the list's `where` (which also applies `status`) and a separate `countsWhere` (`businessId` + `searchFilter` only, **no** `status`) — this is what keeps the inactive pills non-zero when a status filter is active, per the requirement that filtering to `pending` must still return all five real counts, not just `pending`'s.
- All three queries (`findMany`, `count`, `groupBy`) run in the same `Promise.all` as before, so this adds one query round-trip, not three sequential ones.

**Verified (curl + a throwaway gitignored seed/cleanup script, live dev DB)**
- Registered two fresh businesses through the real `POST /auth/register` (approved directly via the existing `setApprovalStatus.ts`-style DB write, matching that script's established technique), then inserted bookings directly via Prisma with a known status distribution per business — 7 pending + 3 approved + 2 rejected + 1 cancelled + 2 more pending named "Zelda" on business A (15 total), 5 pending + 1 approved on business B (6 total, isolated cross-tenant fixture). Distinct `bookingTime`s per row were required to avoid colliding with the pre-existing partial unique index on `(businessId, bookingDate, bookingTime)`.
- Unfiltered `GET /owner/bookings` on business A: `counts` exactly `{ pending: 9, approved: 3, rejected: 2, cancelled: 1, all: 15 }`, matching the fixture precisely.
- `?status=pending` and `?status=approved`: `bookings` correctly narrowed (9 and 3 rows respectively, single status each), but `counts` **unchanged** in both cases — directly confirms the pill-zeroing bug this task exists to prevent.
- `?search=zelda` (no status): `bookings` narrowed to the 2 Zelda rows, `counts` narrowed to `{ pending: 2, approved: 0, rejected: 0, cancelled: 0, all: 2 }` — search does narrow counts, unlike status.
- `?search=zelda&status=approved` together: `bookings` empty (0 Zelda rows are `approved`) while `counts` stayed at the search-narrowed `{ pending: 2, ... }` — proves search and status are applied independently to `countsWhere` vs. `where`, not both dropped or both applied.
- `?search=` with no matches: every count key present and `0`, `all: 0` — confirms the "must return 0, not be absent" requirement even in the fully-empty case, not just the partially-empty one.
- Business B's counts (`{ pending: 5, approved: 1, rejected: 0, cancelled: 0, all: 6 }`) stayed fully isolated from business A's — cross-tenant scoping unaffected by the new query.
- Re-ran the untouched parts of the existing suite against the changed handler: case-insensitive email search (uppercase search term matched a stored lowercase email), invalid `?status=` → `400` unchanged wording, `?page=0` → `400` unchanged, `?page=2` beyond the last page → empty `bookings` with `total`/`totalPages`/`counts` all still correct, no-token request → `401` unchanged.
- All test data (2 businesses, 2 users, 21 bookings) and the throwaway seed/cleanup scripts deleted afterward; confirmed zero matching test users remained.

**Next up**
- No other endpoints touched. Frontend bookings screen can now wire the five pills to `counts` in one round trip once that work starts.

## 2026-08-03 — Owner dashboard shell: auth guard, sidebar, mobile nav

**Shipped**
- **Small backend addition, resolved during planning**: `GET /owner/business` had no way to expose the logged-in owner's own account email — it returns business fields only, and the JWT payload carries `{ userId, role, businessId }`, no email. Added `owner: { name, email }` to the response, joining `Business.userId → User` the same way `GET /admin/businesses/:id` already does, then restructuring the same way that route does (`select` the relation as `user`, rename to `owner` on the way out) rather than inventing a second pattern for the same shape.
- `frontend/src/lib/session.ts`: `getSession()`, a server-only helper that reads the `token` cookie and verifies it with `jsonwebtoken` — the exact same library and secret `backend/src/middleware/authenticate.ts` uses, added as a new frontend dependency with `JWT_SECRET` copied into `frontend/.env.local` (gitignored, value never printed to the terminal). Payload is runtime-checked with the same shape guard as the backend's `isAuthenticatedUserPayload`, so a validly-signed-but-wrong-shape token is treated as no session rather than trusted. Verification happens in the layout (Server Component), not middleware — Next's middleware runtime can't run `jsonwebtoken`, and a second verification library would drift from the first.
- `frontend/src/app/(owner)/layout.tsx`: the real guard, replacing the `// Owner auth guard goes here` stub. No session → `redirect("/login")`. Session present but `role !== "owner"` → silent `redirect("/admin")` — a valid session on the wrong role's routes is treated as an accidental visit, not an error. Otherwise calls `apiFetch("/owner/business")` — a `401` never reaches this layout at all, since `apiFetch` already hard-redirects to `/login?expired=1` internally; a `403` from `requireApprovedBusiness` (pending/rejected/suspended) is caught specifically and rendered as a full-page status screen with the backend's message and `reason` (if any) verbatim, plus a sign-out button, instead of rendering `children` at all — a broken dashboard behind a working shell would be worse than an honest blocked screen. Any other error is left to propagate.
- `frontend/src/components/owner-sidebar.tsx` (desktop, `hidden sm:flex`) and `owner-mobile-nav.tsx` (`sm:hidden`, fixed header + fixed bottom bar), both consuming only theme tokens (confirmed via `grep` — zero raw hex/`rgb()` values in any new file). Sidebar collapse state and the shared `useTheme` hook (`frontend/src/hooks/use-theme.ts`) both read `localStorage`/`matchMedia` inside a `useEffect` rather than a lazy initial state, since neither API exists during the server render each hydrates from — accepted brief first-paint flash on both rather than adding an inline anti-flash script. `npm run lint` initially flagged both as `react-hooks/set-state-in-effect`; this is the correct pattern for a browser-only read that must not cause a hydration mismatch, so both got a one-line `eslint-disable` with the reasoning inline rather than a workaround that would reintroduce the mismatch.
- Collapsed sidebar uses shadcn's `Tooltip` (via Base UI's `render` prop, e.g. `<TooltipTrigger render={row} />`) per icon; mobile header menu uses shadcn's `DropdownMenu` over `Sheet` — chosen since its content is three short rows, not a browsable panel. Both newly added via `npx shadcn@latest add`, following the project's existing "copied source, not a package" convention.
- `frontend/src/components/sign-out-button.tsx` and `theme-toggle.tsx`: shared by both nav variants and the blocked-status screen, so the logout/theme logic exists once each.
- `frontend/src/app/(owner)/loading.tsx` (a real one — a stray, non-functional `(owner)/dashboard.tsx` existed on disk with a header comment claiming it belonged at `dashboard/loading.tsx`; confirmed dead via the build's route table before this session, now deleted and replaced with the genuine file at the genuine path) and `frontend/src/app/(owner)/dashboard/bookings/page.tsx` (heading only, per the task).
- `backend/scripts/setApprovalStatus.ts` (new, gitignored, matches `listOwners.ts`/`deleteTestUsers.ts`'s existing local-only-tooling convention): flips a business's `approvalStatus` directly, needed because there's no API path back to `pending` once a business has been approved/rejected once — the only way to verify the guard's pending-state screen against a still-valid token.

**Verified**
- `npm run build` and `npm run lint`: both clean; the build's route table now lists a real `/dashboard/bookings` where none existed before this session.
- Backend: re-ran the full pending/rejected/suspended/admin-token/PATCH regression suite from the 2026-07-07 devlog entry against the changed `GET /owner/business` handler — all four 403 wordings unchanged, `PATCH` still works and still excludes raw `userId`. New `owner.name`/`owner.email` fields confirmed against a real `User` row.
- Frontend guard, via `curl` with a `Cookie: token=...` header directly against `http://localhost:3000/dashboard/bookings` (a live dev server, not just the build): no cookie → `307` to `/login`; admin token → `307` to `/admin`; approved owner token → `200` with the business name, owner email, and mobile bottom-bar labels all present in the server-rendered HTML. Pending, rejected, and suspended states each tested by minting an owner token while the business was still approved, then flipping `approvalStatus`/`isActive` directly via the new script (same "still-valid stale token" technique every prior `requireApprovedBusiness` verification in this devlog has used) — all three produced the exact backend wording (`"...still under review..."`, `"Your registration was not approved"` + `Reason: <text>`, `"Account suspended"`), confirmed by inspecting the raw HTML around each match rather than trusting a first-pass `grep` (the rejected reason's match initially looked empty because React's SSR inserts an empty `<!-- -->` comment between the label and the value text nodes — confirmed it renders as plain readable text, not a real gap).
- All test data (2 businesses, 2 users, their forms/fields) deleted afterward via a throwaway cleanup script (removed after running, unlike the kept `setApprovalStatus.ts`).

**Blocking fixes**
- The backend dev server on port 5000 was a stale process from an earlier session — file edits weren't being picked up despite `nodemon --exec tsx` supposedly watching. Same recurring issue as several prior sessions; diagnosed via `netstat`/`Get-CimInstance Win32_Process`, killed, restarted clean. The frontend dev server also needed a restart mid-session, unrelated to staleness — adding `JWT_SECRET` to `.env.local` requires a fresh process, since Next only reads env files at startup.

**Open questions**
- **No browser or screenshot tool was available in this environment**, so the collapse toggle, theme toggle, tooltips, dropdown menu open/close, and the actual mobile-breakpoint layout switch were verified by code review and `curl`-based HTML inspection only — not by clicking through a rendered page. Dark mode specifically was verified structurally (every new component uses only theme tokens already defined for both modes in `globals.css`, confirmed via `grep` to contain zero raw colour values) rather than visually. This falls short of "verify both modes before calling it done" in the literal, visual sense — worth an actual look in a real browser next session before treating this shell as fully signed off.
- The recurring stale-backend-process issue (this entry and at least three prior ones) still isn't root-caused — worth investigating properly at some point instead of re-diagnosing it each session.

**Next up**
- Business Profile screen (`/dashboard/profile`) — the first real screen to sit inside this shell. Availability and the Form Builder after that. The `(admin)/layout.tsx` guard is still an identical stub to what `(owner)/layout.tsx` was before this session — needed before `/admin` (the redirect target for a wrong-role owner-shell visit) is anything but a 404.

## 2026-08-01 — Frontend: login, register, forgot/reset-password screens

**Shipped**
- `frontend/src/lib/api.ts`: `apiFetch<T>()`, the one place server-side code calls the Express backend. Reads the `token` httpOnly cookie, attaches it as `Authorization: Bearer`, and on a `401` hard-redirects to `/login?expired=1` — a `403` is deliberately left for the caller to handle inline, since business-status 403s (pending/rejected/suspended) carry a message that needs to render on the page, not vanish into a redirect.
- Five Next.js route handlers under `frontend/src/app/api/auth/`, each proxying one backend `/auth` endpoint from the browser rather than calling Express directly (session decision 9: JWT lives in an httpOnly cookie set by Next.js, never touched by client JS):
  - `login`: on success, sets the `token` cookie (`httpOnly`, `sameSite: lax`, `secure` in production, 24h `maxAge` — matched to the backend JWT's own expiry) and returns only `{ user }`.
  - `register`, `forgot-password`, `reset-password`: pass the backend's response (body + status) straight through, no cookie — none of these three log the user in. `forgot-password`'s handler doesn't even look at the response body before proxying it, so it can't accidentally branch on account-existence and undermine the backend's enumeration-safe design.
  - `logout`: exists solely because client JS can't delete an `httpOnly` cookie itself — clears it server-side.
- Four client forms (`login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`), all following the same shape: client-side checks are structural only (non-empty, email/password regex shape) and every message with real logic — wrong credentials, duplicate email, expired token — round-trips to the backend and is shown verbatim rather than re-implemented in JS. `reset-password-form.tsx` is the one exception: password-confirmation matching is checked client-side because the server only ever receives one password field and structurally can't perform that check.
- `reset-password`'s page reads `?token=` server-side and renders `InvalidResetLink` immediately if it's missing, before the form ever mounts — a tokenless load can only ever fail, so the failure state is shown directly. The form itself also swaps to `InvalidResetLink` (rather than an inline error) if the backend later reports the token invalid/expired, since a dead token makes the form pointless to keep showing.
- Route groups `(public)`, `(owner)`, `(admin)` created with layout files; `(owner)`/`(admin)` layouts are explicit stubs (`// Owner auth guard goes here (decision 10: enforced in layout, not middleware)`) — no guard logic exists yet, so nothing under those groups is access-controlled yet.
- `components/logo.tsx`: `LogoMark`, `Logo`, and `LogoSpinner` (two half-paths cross-fading via offset `steps(1)` animations, honouring `prefers-reduced-motion` through the base layer) — shared across every auth screen and used as the submit-button loading state.
- Both auth-screen layouts (login, register, forgot/reset-password) use the same split-panel structure: a fixed-width dark brand panel + a centered `max-w-[380px]` form column, collapsing to stacked on mobile.

**Verified (this session — code review + `npm run build`, not a live-session QA log)**
- These commits (`7d52e59`, `c8e0a8d`, `f87eac6`) predate this devlog entry and weren't accompanied by recorded manual test notes at the time, so "Verified" here reflects this session's review rather than the original build session.
- `npm run build` (Next.js 16 / Turbopack) compiles cleanly and TypeScript passes with no errors.
- The build's route table confirms exactly what's actually reachable: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, plus the 5 `/api/auth/*` handlers. No `/dashboard` or any `(owner)`/`(admin)` route exists yet (see open question below).
- Read through all four forms and the 5 route handlers directly: confirmed the cookie is `httpOnly` on login only, confirmed `forgot-password`'s handler never branches on the backend's response body, confirmed `reset-password`'s `400` path swaps to `InvalidResetLink` rather than an inline error.

**Blocking fixes**
- None recorded.

**Open questions**
- `frontend/src/app/(owner)/dashboard.tsx` is dead code: its own header comment reads `// src/app/(owner)/dashboard/loading.tsx`, but the file is actually saved one level up, as `(owner)/dashboard.tsx` — not a valid Next.js file name in that position, and confirmed by the build's route table to produce no route at all. Looks like a misplaced file from starting the dashboard screen; needs moving to `(owner)/dashboard/loading.tsx` (or a real `dashboard/page.tsx` built alongside it) before the owner area has anything to show.
- Root `CLAUDE.md`'s "Frontend" section still says the frontend is "scaffolded but has no screens yet" and that the `(public)`/`(owner)`/`(admin)` route groups are "Not yet built" — stale as of this and the previous entry; worth a follow-up update alongside this devlog entry.
- No auth guards exist in the `(owner)`/`(admin)` layouts yet (both are literal TODO stubs) — anything routed under those groups today would render with no access control at all, though nothing is routed there yet.

**Next up**
- The owner and admin auth guards (decision 10), then the owner dashboard/profile/availability/form-builder/bookings screens and the admin platform screens — the backend endpoints for all of these have been feature-complete since 2026-07-25. The public business booking page (the only unauthenticated screen besides the ones shipped here) is also still unbuilt.

## 2026-07-31 — Frontend scaffold: Next.js 16 + Tailwind v4 design system + shadcn/ui

**Shipped**
- Next.js 16 (App Router, `src/` directory, TypeScript, Turbopack) initialized in `frontend/`, alongside the two governing spec PDFs (`Orbis_Scheduler_Frontend_Specification.pdf`, `Orbis_Scheduler_Design_Specification.pdf`) checked into `docs/`.
- Tailwind v4 wired entirely through `globals.css` (no `tailwind.config.ts` — v4 moved configuration into CSS): `:root`/`.dark` raw token values plus an `@theme inline { }` block that turns them into utilities. The `inline` keyword is load-bearing — without it, a utility resolves its `var()` at build time and dark mode silently stops working. Dark mode itself is class-based (`@custom-variant dark (&:where(.dark, .dark *))`), overriding v4's default `prefers-color-scheme` behaviour so a manual toggle is possible later.
- Full design-system token set added per the design spec: `surface-0/1/2`, `border-default/strong`, `text-primary/secondary/muted/disabled`, `brand`/`brand-on`/`brand-subtle`, and the four status pairs (`pending`, `approved`, `rejected`, `cancelled`, each with a `-text` variant).
- shadcn/ui initialized on Base UI primitives, components copied into `src/components/ui/` (not installed as a dependency — no `shadcn` package in `package.json`, so they're ordinary editable source). `button.tsx` customized on add: radius forced to `rounded-sm` (6px per spec, overriding shadcn's default across every size variant) and the off-scale `text-[0.8rem]` replaced with `text-sm` to stay on the project's five-size type scale. shadcn's own tokens (`--primary`, `--card`, `--accent`, etc.) are mapped to the project tokens so components inherit the palette automatically — `--accent` in particular is called out as shadcn's neutral hover colour, not the brand orange, to avoid future confusion.
- DM Sans loaded via `next/font/google` for UI text, Geist Mono for code.
- Root `CLAUDE.md` rewritten to cover both apps: backend architecture/conventions consolidated from the old `backend/CLAUDE.md`, plus a new Frontend section (stack, Tailwind v4's CSS-based config, token usage rules, shadcn conventions, planned route-group structure, session-handling decision) and a repo-wide "Working practices" section formalizing the devlog/`FUTURE_IMPROVEMENTS.md` update habit already in use.

**Verified (this session — code review + `npm run build`, not a live-session QA log)**
- `npm run build` compiles cleanly on the current tree (see the 2026-08-01 entry above for the full route table), confirming the base scaffold, token wiring, and `button.tsx` customization all still build correctly together with the screens added on top of them.

**Blocking fixes**
- None recorded.

**Open questions**
- None recorded from this session.

**Next up**
- Auth screens (login/register/forgot-password/reset-password) consuming `POST /auth/*` — shipped same week, see the entry above.

## 2026-07-25 — Admin platform overview (stats, business list/detail, suspend/activate)

**Shipped**
- **"This week" decision, confirmed before writing code**: `bookingsThisWeek` in `GET /admin/stats` uses a rolling 7-day window (`now - 7 days` through `now`), not the current calendar week. Deliberately not reusing the project's existing Monday=0 week convention (`AvailabilityRule.dayOfWeek`) — that's about which day a business is open, a different concept from a trailing activity metric that shouldn't reset to near-zero every Monday morning.
- **Confirmed understanding of the intentional cross-tenant gap**: `GET /admin/stats`, `GET /admin/businesses`, and `GET /admin/businesses/:id` have zero `businessId` scoping anywhere — admin tokens never carry one at all, so there's no tenant to scope by. This is the one legitimately unscoped part of the API, matching the already-existing `approve`/`reject` handlers and CLAUDE.md's "platform overview" framing.
- `GET /admin/stats`: 7 platform-wide numbers (`totalBusinesses, pendingRegistrations, approvedBusinesses, rejectedBusinesses, suspendedBusinesses, totalBookingsLifetime, bookingsThisWeek`).
- `GET /admin/businesses`: paginated (25/page), `status`/`isActive`/`search` filters (name or owner email, case-insensitive), `totalBookings` per row via Prisma's `_count` (first use of that pattern in this codebase — avoids N+1 querying in a loop).
- `GET /admin/businesses/:id`: full detail including nested `owner: { name, email }` and `totalBookings`.
- `PATCH /admin/businesses/:id/suspend` / `.../activate`: both require `approvalStatus === 'approved'` (pending/rejected are governed by the existing approve/reject endpoints, not these), exact "Business is already suspended" wording per the use case doc, mirrored "Business is already active" for the reverse, no email on either (explicit per the use case doc for suspend; extended the same silence to activate by inference, since every *other* email-sending endpoint in this codebase says so explicitly and this one doesn't).

**Verified (curl + a DB script for independent cross-checks, live dev DB)**
- Found **1 pre-existing business ("AF Architects") and 2 bookings already in the DB** at the start of this session — not created by any of my scripts (no timestamp-suffixed test email pattern), and a business with this exact name/owner was already logged as cleaned up once before (2026-07-02 devlog), suggesting the user manually recreated it via Postman since. Left it completely untouched rather than assuming it was safe to delete — accounted for it in baseline math instead, and confirmed after cleanup that `GET /admin/stats` returned to the *exact* pre-test baseline, proving nothing but this session's own test data was touched.
- **Stats cross-checked two ways per number**: an independent DB script computed each of the 7 values separately from the route's own logic, and both matched exactly (5 businesses, 1 pending, 3 approved, 1 rejected, 0 suspended, 7 bookings lifetime, 6 this week). The `bookingsThisWeek` check specifically included backdating one real booking's `createdAt` to 10 days ago — confirmed it was included in the lifetime total but excluded from the 7-day count, proving the window boundary actually works rather than just returning a plausible-looking number.
- `GET /admin/businesses` pagination shape confirmed; `totalBookings` spot-checked against every single business in the result set (not just 2-3), including the pre-existing one — all matched reality exactly.
- All three filters confirmed individually (`status=approved` → 3, `isActive=false` → 0, name/email search both case-insensitive) and combined (`status=approved&search=...` correctly intersected, dropping a business that matched the status but not the search term).
- `GET /admin/businesses/:id` detail shape and nested `owner` confirmed; nonexistent id → `404`.
- Full suspend → already-suspended → activate → already-active lifecycle, plus suspend/activate attempted on pending and rejected businesses (all four correctly `400` with the current status named).
- **Suspend's real-world effect, not just the `isActive` column**: suspended a business, then confirmed its owner's `POST /auth/login` immediately started returning `403 "Account suspended"` (previously `200`) and `GET /public/businesses/:id` immediately started returning `404` (previously `200`) — both via *existing* code paths that already read `isActive`, now genuinely exercised end-to-end rather than assumed to work from a column update alone.
- All 5 endpoints with an owner token → `403 "Admin access required"`.
- All 4 test businesses (and their bookings/forms/fields) deleted afterward; the pre-existing "AF Architects" data left exactly as found.

**Blocking fixes**
- Same recurring stale-port-5000-process issue as the last two sessions — caught immediately via the same `netstat`/`taskkill` check before starting, and again after `TaskStop` at the end (a `tsx`/nodemon child keeps surviving `TaskStop` across sessions; worth fixing properly at some point rather than re-diagnosing it each time).

**Open questions**
- Whether "no email on activate" was the right call — the use case doc was explicit about suspend, silent on activate. Flagged during planning as an inference, not a confirmed requirement.
- The "AF Architects" business now has a documented, deliberate reason for existing untouched in the dev DB (this entry) — worth an actual decision at some point on whether it's real ongoing manual-testing data to keep or safe to finally clean up.

**Next up**
- The admin side of the platform is now feature-complete for MVP (approve/reject/suspend/activate/stats/list/detail). Remaining known gaps across the whole project: no frontend yet, `Booking` has no indexes beyond its PK (noted in the previous session), and the recurring stale-server-process issue above.

## 2026-07-25 — Owner-facing booking management (5 endpoints)

**Shipped**
- **404-vs-403 decision, resolved with evidence before writing any code**: the task doc's design principles and UC9 A3 disagreed on what happens when an owner hits a `:id` route for another business's booking (404 vs. 403 Forbidden). Traced it through git history — the only place this codebase ever used `403` for a cross-tenant mismatch was a draft route deleted in the very next commit; the live, most-recently-written precedent (`PATCH`/`DELETE /form/fields/:id`) uses `404` for exactly this scenario, reserving `403` for a different concern entirely (business-rule violations, not tenant mismatch). Went with `404`, matching the codebase's actual convention over the older use-case doc.
- `GET /owner/bookings` (`backend/src/routes/owner.ts`): paginated (25/page), scoped to `req.user.businessId` regardless of any param, optional `status` filter (validated against the 4 enum values) and `search` (case-insensitive `contains` match against `customerName` OR `customerEmail` — the first use of Prisma's `mode: 'insensitive'` anywhere in this project). Returns `{ bookings, total, page, totalPages }`.
- `GET /owner/bookings/:id`: full detail including `fieldValues` resolved to `{ label, value }` pairs (joined through `FormField`, ordered by `displayOrder`) instead of raw `formFieldId`s.
- `PATCH /owner/bookings/:id/approve|reject|cancel`: each requires a specific prior status (`pending` for approve/reject, `approved` for cancel — cancel only applies post-approval per UC9 A2), optional `ownerNotes`, best-effort customer-notification email. Wrong-state attempts get `400` with the actual current status named in the message (unlike `admin.ts`'s narrower "already approved" precedent, this can fail from several different prior states, so the message says which one).
- Three independent `PATCH` handlers, not a shared helper, despite the similarity — matches `admin.ts`'s approve/reject precedent, which has the same shape of duplication and also doesn't abstract it.

**Verified (curl + a small Node script for bulk test-data creation, live dev DB)**
- Created 27 bookings via the real `POST /public/bookings` endpoint (not a DB script) to get genuine pagination test data, plus 4 named bookings for the individual status-transition tests, plus 1 for a second business (cross-tenant check).
- `GET /owner/bookings` unfiltered: `total: 31, page: 1, totalPages: 2`, exactly 25 on page 1 and 6 on page 2, exact field set per spec, newest-first ordering.
- `?status=` filtering confirmed both ways (31 pending, 0 approved, before any transitions); invalid `status` → `400`.
- `?search=` confirmed case-insensitive on **both** fields independently: a lowercase partial-name search matched a title-cased customer name; an uppercase full-email search matched a lowercase stored email. A non-matching term correctly returned zero results.
- `GET /owner/bookings/:id` detail shape confirmed, `fieldValues` showing real labels ("Name"/"Email"/"Phone"), not ids.
- Cross-business `:id` and a nonexistent `:id` → diffed the two 404 response bodies, byte-identical — directly validates the decision above wasn't just a stated intention.
- Full approve → re-approve (`400`, current status named), reject, and cancel flows all verified end-to-end, including **re-querying `GET /public/slots` before and after each reject/cancel** to confirm the freed slot actually flips back to `available: true` — not just that the `Booking.status` column changed, but that the change is visible through the other endpoint that reads it.
- Cancel-on-a-still-`pending`-booking correctly rejected (`400`), confirming UC9 A2's approved-only rule.
- All 5 endpoints × pending/rejected/suspended business states → all 15 combinations returned the exact matching `requireApprovedBusiness` wording.
- A genuinely useful side-effect of the volume test: Mailtrap's sandbox hit a **harder limit than last session's** — `535 5.7.0 The email limit is reached` (an account-level quota, not the earlier per-second throttling), from the cumulative 60+ emails this session's test data generated. Every failure was still caught and logged without blocking a single response, including during the approve/reject/cancel tests — the exact behavior the spec requires, now confirmed under a harder failure mode than previously observed.
- All test data (both businesses, all 32 bookings) and the throwaway verification script deleted afterward.

**Blocking fixes**
- None new — same stale-port-5000-process issue as last session (a leftover `tsx`/nodemon child survived `TaskStop`), caught immediately this time via the same `netstat`/`taskkill` diagnostic before it could cause confusion, and cleaned up again after this session's server was stopped.

**Open questions**
- Mailtrap's sandbox quota is now hard-exhausted for real email-delivery confirmation (not just rate-limited) — worth checking the account limits/upgrading before relying on Mailtrap for demo purposes, or switching test conventions to create less booking volume per session.
- `Booking` still has no indexes beyond its primary key (noted during planning, not fixed here, out of stated scope) — `businessId`/`status`/`createdAt` are all filtered/sorted on in the new list endpoint with nothing but a sequential scan backing it. Fine at current data volumes, worth revisiting before real load.

**Next up**
- This closes the core owner-facing booking loop (create → view → approve/reject/cancel). Remaining known gaps: admin's ability to suspend a business (`isActive`) has no API path yet (only direct DB access, used repeatedly across sessions for testing), and there's still no frontend consuming any of this.

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
