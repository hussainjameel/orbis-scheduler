# Orbis Scheduler — Development Log

## 2026-08-10 — Redesigned dropdown/radio/checkbox rendering on the Public Booking Page

Replaces the pill-based rendering for these three field types, built in the original session, with a real select trigger for dropdown and a vertical native-input list for radio/checkbox. Scoped strictly to this page — the owner's booking-detail "Submitted answers" card and the Form Builder's field-type badges keep their existing pills untouched (confirmed via grep: `FieldPillGroup` was only ever imported by this page's own `dynamic-form-fields.tsx`). This page's own **confirmation** screen also deliberately kept its pills — that's a read-only "here's what was submitted" summary, the same category as the owner's card, not an input; screenshotted after the change to confirm it still renders correctly against the new controls' output.

**Shipped**
- `field-select.tsx` (new): dropdown now reuses `@/components/ui/select.tsx` — the same `Select`/`SelectTrigger`/`SelectContent`/`SelectItem` the Availability screen's time pickers already use (`day-card.tsx`), not a second select implementation. Real keyboard/screen-reader listbox semantics come from Base UI's primitive for free.
- `field-choice-list.tsx` (new): shared vertical-list renderer for radio (single-select, 18px circle + centered dot) and checkbox (multi-select, 18px rounded-sm square + centered checkmark). Real native `<input type="radio"/"checkbox">` under `appearance-none` custom visuals — not divs with `onClick` — each option is one `<label>` wrapping both the indicator and the text, so clicking the text selects it. All radios in one field share a `name` so native browser arrow-key group navigation works without any extra code.
- `field-pill-group.tsx` deleted, fully superseded by the two files above.
- `dynamic-form-fields.tsx`: `FieldInput`'s dropdown/radio/checkbox branches swap to the new components; text/textarea, `FieldLabel`, and all spacing from the last pass are untouched.

**The mobile-scrolling question, resolved without adding a fallback**
Checked AF Architects' real field data before deciding: option counts run 4–6 per field. At `gap-3` with an 18px indicator + one line of label, six options run to roughly 250px — that's normal page *length* on an already-intentionally-long continuous-scroll form, not a trapped internal scroll area. Decided **against** a 2-column fallback: this app's real option labels ("Initial Design Consultation", "3D Modelling & Rendering") are long enough that a 2-column grid on a 375px viewport would force awkward mid-word wraps in the narrower column — worse than the single column the brief already locked as the base requirement, not better.

**Blocking fixes (both found via live screenshots, not caught by code review alone)**
- **The selected-state indicator (checkmark / center dot) was completely invisible on first pass** — the checkbox showed a solid orange square with no checkmark, the radio showed only a colored ring with no visible center dot. Root cause: the `<input>` is `position: absolute` (to exactly overlay the 18px indicator box) while the checkmark/dot was a plain static-flow sibling — by default CSS stacking order, *any* positioned element paints above *all* non-positioned siblings regardless of DOM order, so the absolutely-positioned input was silently painting over the indicator every time. Fixed by giving the indicator its own `relative` positioning so it participates in DOM-order stacking among positioned siblings and correctly paints on top. Caught by zoomed-in screenshots after the base implementation looked right at a glance — a plain full-page screenshot didn't show it clearly enough to notice.
- A Base UI console warning ("A component is changing the uncontrolled value state of Select to be controlled") on first selection in `field-select.tsx` — the `value` prop started as `undefined` (uncontrolled) and became a real string after a pick (controlled). Fixed by passing `value ?? ""` instead, always controlled from first render; confirmed via Base UI's own source comment that an empty-string value still counts as "no selection" for placeholder purposes, so the placeholder still renders correctly.

**Verified**
- `npx tsc --noEmit` + `npm run lint` clean.
- Live Playwright pass against AF Architects' real dropdown (4–6 options)/radio (3 options)/checkbox (4 options) fields: dropdown opens/selects via mouse and via keyboard (Enter to open, arrows to navigate, Enter to select) and shows the placeholder correctly before a pick; radio confirmed exactly-one-selected across every click (including clicking label *text*, not just the indicator) and native ArrowDown group navigation works via the shared `name`; checkbox confirmed multiple independent selections, including via label-text clicks; zero old pill-button elements remain anywhere on the page; full submission verified end-to-end (`201`, confirmation screen correctly reflects every new-control selection through its own unchanged pill summary). Both light and dark mode, desktop and mobile viewports. Zero console errors after the two fixes above.
- Test booking created during verification deleted afterward; AF Architects' real config untouched.

## 2026-08-10 — Public booking form accepted garbage email addresses (client and server)

Flagged from real test bookings on AF Architects where the Email field held junk like "X Y Z" — confirmed real, not a fluke: `POST /public/bookings` had zero email format validation, and neither did the frontend. Every other part of the public booking form's validation was checked at the same time (name, phone, dynamic fields) — nothing else needed the same fix; see reasoning below.

**Root cause**: `auth.ts` (registration) has always validated email format server-side (`EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/`, mirrored client-side in `register-form.tsx`) — but that check never made it into `POST /public/bookings`, which only checked that `customerEmail` was present, not that it looked like an email. The booking page's dynamic field renderer treats Email as just another generic `fieldType: "text"` field (which it is, in the schema — there's no dedicated "email" field type), so it rendered as a plain `type="text"` input with no format hint or check at all.

**Fixed**
- `backend/src/routes/public.ts`: added the exact same `EMAIL_RULE` regex and `'Invalid email format'` error copy as `auth.ts`, checked right after the existing required-fields check in `POST /bookings`. One consistent standard for "does this look like an email" across the app instead of registration having one and bookings having none.
- `frontend/src/lib/public-booking.ts`: added `validateEmailFormat()`, mirroring the same regex client-side (sanctioned by decision 4 as a free check, since it's reading the same shape rule rather than duplicating real logic) — wired into `booking-page-client.tsx`'s submit handler alongside the existing required-field check, same toast + inline-error treatment.
- `dynamic-form-fields.tsx`: the Email field (identified via `isProtected`, same reliable match used elsewhere) now renders `type="email"` instead of a blanket `type="text"` for every text field — free native keyboard/format hinting on mobile, no new logic. Gave the Phone field `type="tel"` too while in there, matching `register-form.tsx`'s own convention for its phone input.
- **Deliberately did not add phone-format validation.** Unlike Email, there's no existing regex anywhere in this codebase to mirror for phone numbers (registration doesn't validate phone format either, since it's optional there), and international phone formats are genuinely hard to validate correctly without a library — inventing one now would be new logic with real drift/false-negative risk, not a "free" mirror of an established rule. Flagging this as a known gap rather than a silent skip.

**Verified**
- Direct `POST /public/bookings` with `customerEmail: "X Y Z"` → `400 { "error": "Invalid email format" }`, confirmed via curl.
- Live Playwright pass: Email field confirmed `type="email"`; submitting "X Y Z" as the email shows the inline "Enter a valid email address." error and the existing validation-failure toast together, and — confirmed directly via request listener — **no `POST /public/bookings` request fires at all**, so the bad data never reaches the network.
- `npx tsc --noEmit` + `npm run lint` (frontend), `npx tsc --noEmit` (backend) all clean.

**Open questions**
- The junk test bookings already in the database (created before this fix, e.g. on AF Architects) were left alone — not deleted, since they're the user's own test data and cleanup wasn't asked for.

## 2026-08-10 — Booking page bug fixes + Form Builder's missing booking-window control

Live review pass on the booking page shipped earlier today, plus one unrelated gap it exposed in the Form Builder. Investigated every reported item directly against the running app (not just the report text) before touching code — two of the eleven turned out not to be bugs.

**Not bugs, confirmed by live investigation**
- **"All field types render identically" / "pills selected across unrelated groups"** — not reproducible. Live DOM dump against AF Architects confirms every field type renders correctly (text/textarea → underline input, dropdown/radio → pill radiogroup, checkbox → multi-select pills), and clicking one pill in one group selects only that pill — confirmed zero cross-group state leakage. The four pill labels named in the report each belong to a different dropdown field; a real shared-state bug producing that would require the same literal string to coincidentally be a valid option in four unrelated arrays. Also found, while investigating: form field id 170 ("new radio," present when the page was first built earlier today) no longer exists in the database at all — unrelated to this session, but consistent with the screenshot in question predating current state. Re-screenshotted after all other fixes landed to close this out with current data rather than just asserting it (`docs/DEVLOG.md`'s own screenshots from this session show clean, independent pill state).
- **Mobile CTA width** — no existing "mobile CTA button" convention to defer to (`owner-mobile-nav.tsx`'s bottom bar is a tab-bar, not a submit action; the only full-width mobile submit button in the app, in the auth forms, is a boxy `rounded-sm` shape that contradicts this page's own already-locked pill requirement). Kept the pill shape, made the button itself content-width + centered inside a still-full-width sticky bar.

**Fixed**
- `time-wheel.tsx`: the glass effect used `backdrop-filter: blur()`, which blurred the centered/selected time — backwards from an iPhone-style magnifier, which keeps content sharp and enlarges it. Removed the blur function entirely (kept `saturate(1.4)`), added a `scale()` transform to the existing per-row lerp (1.16 at center → 1 at the edges) — confirmed live via computed style (`matrix(1.16, 0, 0, 1.16, 0, 0)` on the centered row) and screenshot (crisp, visibly larger text, no softening).
- Same file, a real second bug found while investigating the reported dark-mode color issue: theme colors were read once (`if (!colorsRef.current) ...`) and cached forever. Combined with the fact that this page had **no dark-mode application logic at all** (next item) — a stale light-mode-RGB cache would render dark-on-dark the moment dark mode actually activated. Removed the cache; colors are read fresh on every `applyStylesOnce()` call (cheap — one `getComputedStyle` on the root element, no layout triggered).
- **This page had zero theme detection of any kind.** The app's only dark-mode logic lives in `useTheme()` (`hooks/use-theme.ts`), a `useEffect` that must be called by some mounted component — nothing on this page called it, so an anonymous visitor always got light mode regardless of OS preference, full stop (not just a brief flash — this session's own earlier "dark mode" verification screenshots only worked because the test script force-added the class manually, which isn't real behavior). Added `theme-script.tsx`, a blocking inline `<script>` (part of the server-rendered HTML, executes before hydration paints) rendered in every branch of `page.tsx` and in `loading.tsx`: reads `localStorage`'s `orbis-theme` key first (same key `useTheme()` uses), falls back to `prefers-color-scheme`. Decided **OS-preference only, no manual toggle** — no natural chrome slot exists for one on this page (deliberately headerless/sidebarless, unlike every other screen), and a one-time anonymous visitor has little reason to want a persisted override.
  - This introduced a real, expected React hydration warning (the inline script mutates `<html>`'s class before hydration runs, which React's comparison flags) — fixed the standard, narrowly-scoped way: `suppressHydrationWarning` on `<html>` in root `layout.tsx` (the same pattern Next's own dark-mode guide and `next-themes` use). Confirmed via a targeted before/after check that the warning is gone.
- `booking-page-client.tsx`: "Your details" heading was hidden on desktop (`sm:hidden`, a deliberate call from the original build reasoning the card border was grouping enough) — reversed per this feedback, now shows in the same style as "Select a date"/"Select a time" on both breakpoints.
- Added `toast.error("Fix the highlighted fields before saving")` alongside the existing inline field errors on a failed submit — reusing the exact string already established in `availability-form.tsx`'s `onInvalid`. The toast position needed no separate fix: the `Toaster` is a single global instance mounted once in root `layout.tsx`, already top-right-desktop/bottom-mobile everywhere including this page.
- Form Builder: `PUT /owner/form` already accepted and validated `bookingWindowDays` (`owner.ts`) — the title/description editor never got a field for it, so every business was silently stuck on the 30-day default with no way to change it. Added a `Select` (7/14/30/60/90-day presets, matching `day-card.tsx`'s existing Select pattern) to `title-description-form.tsx`, wired to the same `PUT`. Verified end-to-end through a real login: default shows 30, changing to 60 and saving round-trips a real `200`, and the new value survives a reload.

**Enhancements**
- Desktop max-width now steps up at `xl`/`2xl` (`700px` → `820px` → `960px`, Tailwind's stock breakpoints — no custom ones exist in this project) instead of one fixed value regardless of monitor size.
- Mobile header now centers like desktop already did (was `text-left sm:text-center`, an unintentional inconsistency), and the gap to the first card bumped from `mt-8` (32px) to `mt-12` (48px) — both real spacing-scale values.
- `dynamic-form-fields.tsx`: gap between field groups `gap-6`→`gap-8` (24→32px), and each label's gap to its own control `mb-1.5`→`mb-2` (6px, itself an oversight not actually on the spacing scale, →8px, the real nearest value).
- Mobile sticky CTA bar bottom padding is now safe-area-aware (`max(1rem, env(safe-area-inset-bottom))`) so the button doesn't read as flush against the edge on notched/gesture-nav devices.

**Verified**
- `npx tsc --noEmit` + `npm run lint` clean throughout.
- Live Playwright pass: cold visitor with OS dark preference gets `.dark` applied with zero manual JS injection (confirmed via Playwright's `colorScheme` context emulation, not a forced class); cold visitor with OS light preference stays light; wheel's centered row confirmed scaled+sharp via computed style in both themes; desktop "Your details" heading confirmed visible; validation-failure toast confirmed firing with inline errors together; max-width confirmed at 1024/1400/1700px viewports (700/820/960px respectively); mobile header centering and CTA content-width (button narrower than its full-width bar) both confirmed; Form Builder's new control confirmed end-to-end through a real login → change → save → reload cycle. All test data cleaned up afterward (two throwaway businesses registered/approved/deleted via the real endpoints); AF Architects itself untouched throughout.
- Noticed a "1 Issue" Next.js dev-overlay badge in two early screenshots; not reproducible on a clean re-run and produced zero console output either time — logged here as an observation rather than chased further, since it's dev-only chrome (won't exist in a production build) and never showed an actual message to investigate.

**Open questions**
- None new — the two "not a bug" findings above are the only unresolved-feeling items, and both were investigated to a firm conclusion rather than left open.

**Next up**
- `widget.js` remains the one known unbuilt piece from the original frontend spec.

## 2026-08-10 — Public Business Booking Page (`/book/[businessId]`)

The last unbuilt screen from the frontend spec's build order, and per the spec itself "the highest-value screen in the whole product." Mobile (single continuous scroll) and desktop (two-card layout) share one component tree and one state model, split at `sm:` — the project's one established breakpoint.

**Doc corrections needed (same category as the earlier UC10/iframe and 404-vs-403 fixes)**
- **Three different strings exist for the "slot taken" race, not two.** UC2 A3 says "This slot was just booked, please select another"; UC3 A1 says "Sorry, this slot was just requested by someone else. Please select another time." — neither matches what `public.ts` actually returns, on both the optimistic pre-check and the real DB-race path: `"This slot was just taken. Please select another time."` Built to the real string, per decision 4 ("the returned error message is displayed as-is"). UC2/UC3 should be reconciled with each other and with the shipped copy.
- **UC2 A2's quoted copy ("Invalid value for [field label]") doesn't match the backend either** — the real message is `"${field.label} must be one of the provided options"` (`public.ts:223`). Shown verbatim, not UC2's wording. Nearly unreachable from the UI regardless, since pills only emit real option values.
- **UC1 A1–A4 imply three distinguishable messages** ("not yet available" / "currently unavailable" / not found) for pending/rejected/suspended/nonexistent businesses. The backend deliberately collapses all four into one identical 404 (tenant-enumeration prevention, per `CLAUDE.md`), so the frontend has no signal to tell them apart and renders one "Business not found" state for all four. UC1 should be updated to match the backend's actual (intentional) behavior.
- **UC1 A5's copy is exactly right and was used as-is**: "No slots available yet" in the calendar area, with the header and booking form still rendering around it.

**Shipped**
- `backend/src/routes/public.ts`: `GET /businesses/:businessId` widened (additive only, no migration) to also return the business's weekly `availability` pattern (`{dayOfWeek, isAvailable}` ×7 — day-granularity only, enough to dim closed weekdays; actual bookable times for a date still come exclusively from the unchanged `GET /slots`) and its active `form` with `fields` (including `isProtected`, load-bearing — see Blocking fixes). Neither existed on any public route before this; there was no way to fetch a business's form fields publicly at all.
- `frontend/src/app/(public)/book/[businessId]/{page,loading,booking-page-client,booking-calendar,time-wheel,field-pill-group,dynamic-form-fields,booking-summary-card,booking-confirmation}.tsx` + `frontend/src/lib/public-booking.ts` (types, date/availability helpers, `resolveCustomerIdentity`, `validateRequiredFields`, `buildFieldValues`).
- Fields are rendered from `business.form.fields` with **zero special-casing for Name/Email/Phone** — per UC2 A4, an unmodified form (just those three) falls out of the same generic per-`fieldType` loop as everything else, rather than a hardcoded universal-fields branch. Name/Email are singled out for the top 2-column grid via `isProtected` (immutable, can't be renamed or deleted — confirmed against `owner.ts`'s 403 guards); Phone is matched by its default label only, best-effort, same precedent as `DEFAULT_FIELD_LABELS` in `bookings/[id]/page.tsx` — if renamed (AF Architects renamed theirs to "Mobile Number"), it just renders as an ordinary field below instead of in the top grid, still fully functional.
- Time wheel built to the full spec: real scroll-position-driven `requestAnimationFrame` loop lerping font-size/weight/opacity/color per row (colors read from the live `--text-primary`/`--text-muted` CSS custom properties at runtime, never hardcoded, so dark mode resolves correctly), `scroll-snap`, hidden native scrollbar, glass band with inset-shadow edges and `backdrop-filter`, top/bottom fade masks, commit-on-settle via `scrollend` where supported with a debounce fallback.
- Added `react-day-picker` (`npx shadcn@latest add calendar` pulled in the dependency but was aborted before writing `calendar.tsx` — it would have overwritten the already-customized `button.tsx`; built `booking-calendar.tsx` as a bespoke component directly against `DayPicker` instead, matching the plan's own file list).
- `PublicSidebar` (the shared shell for the other three `(public)` screens) deliberately **not** reused — its brand-panel/narrow-column shape is built for auth/marketing screens; this page gets its own plain layout, a deliberate divergence flagged here rather than done silently.
- Underline-style (border-bottom-only) inputs and the sticky pill CTA are genuinely new patterns — confirmed nothing like either exists anywhere else in the app (every existing input is a bordered box) before building them.
- Locked-brief pixel values that don't land on the real 5-value type scale were rounded to the nearest token (14px business name → `text-sm`/13px, 12px description → `text-xs`/11px, ~12.5px pills → `text-sm`/13px), matching the project's own precedent (Share & Embed's `p-5`→`p-4` deviation). The wheel's continuously-interpolated font-size (20→12px) and font-weight (600→400) are runtime inline styles driven by scroll position, not static class choices, so they sit outside the five-size/two-weight rule the same way the loading-spinner keyframe animation already does.

**Blocking fixes (all found during this session's own live verification, not left for later)**
- **Calendar dimming was a complete no-op.** react-day-picker applies modifier-driven classes (`selected`/`disabled`/`outside`/custom modifiers) to the `<td>` gridcell, not the inner `<button>` — but `day_button`'s classNames hardcoded `text-text-primary` directly on the button, which always wins over an inherited color from its ancestor regardless of the `<td>`'s own class. Every day rendered identically no matter what. Fixed by swapping in a custom `DayButton` component (react-day-picker's own supported extension point for exactly this) that reads `modifiers` directly and sets its own class — confirmed visually afterward that closed weekdays are actually dimmed in both themes.
- **Required-field validation and the universal Name/Email fields were both silently broken.** The widened endpoint's Prisma `select` never included `isProtected`, so `resolveCustomerIdentity`'s `isProtected`-based lookup for the Name/Email fields always failed, leaving `customerName`/`customerEmail` empty on every submission — every real booking attempt 400'd with "customerName and customerEmail are required" despite both being visibly filled in. Root cause, not a symptom: added `isProtected: true` to the `formFields` select in `public.ts`.
- **Clicking a wheel row could silently fail to select anything.** `scrollTo()` fires no native `scroll` event at all when the target position doesn't actually change (a single-remaining-slot wheel, or re-clicking the already-centered row) — and `commit()` only ever ran from the scroll-settle path, so the CTA could stay disabled with no way to proceed. Fixed by having a row click commit directly (an explicit click is an unambiguous selection, no need to infer intent from scroll state) alongside the existing smooth-scroll-into-place.
- Tuned the glass band's `backdrop-filter` blur down from 2px to 0.75px after seeing it live — at 2px the centered/selected value (the single most important piece of text on the wheel) was hard to read through its own "glass," working against the point of a picker. Kept the lens/saturate quality, dropped the amount that made the selected time illegible.

**Verified**
- `npx tsc --noEmit` and `npm run lint` (frontend), `npx tsc --noEmit` (backend, clean other than the pre-existing unrelated `setApprovalStatus.ts` script error) all clean.
- Live Playwright pass (no MCP browser tool available in this environment; a scratch-directory `npm install playwright` against the already-cached Chromium substituted, same technique prior sessions used) against AF Architects (real availability + a 12-field form covering every `fieldType`) and a fresh throwaway business (registered → admin-approved via the real endpoints, no availability ever set): full booking submission end-to-end (201, confirmation screen content matched exactly what was submitted, including dynamically-rendered dropdown/radio/checkbox pills), required-field blocking, closed-weekday dimming vs. disabled out-of-window dates (confirmed via computed class, not just visually), the UC1 A5 no-availability state (form and header still render, only the calendar area swaps), UC2 A4 falling out naturally (the throwaway business's unmodified form rendered only Name/Email/Phone with zero special-case code), the "Business not found" 404 collapse, and the real race condition — **two genuinely concurrent submissions for the same slot** (`Promise.all` over two browser contexts, not sequential), confirming exactly one `201` and one `409` with the verbatim backend message, the losing page's entered data (name/email/every pill selection) completely intact, and the taken slot gone from the re-fetched wheel. Both light and dark mode checked on every state above, desktop and mobile viewports both checked against the two mockups. Zero console/page errors in any run.
- All test data cleaned up afterward: 7 test bookings deleted from AF Architects (AF Architects itself untouched), the throwaway business and its owner user fully deleted, all temporary verification scripts removed from `backend/scripts/`.

**Open questions**
- The wheel's keyboard support (Up/Down/Enter) and ARIA (`listbox`/`option`) are a best-effort pass, not exhaustively tested — there's no native element this custom widget can fall back to.
- "No times available on this date" (a day open by weekly pattern but fully booked for that specific date) shares its render path and component with the "no availability configured at all" state, already verified — not separately re-tested against a deliberately-fully-booked day, given the shared code path.

**Next up**
- Every screen in the frontend spec's original build order is now shipped. `widget.js` (the embeddable popup-modal script Share & Embed's snippet points at, per decision 6) remains the one known unbuilt piece.

## 2026-08-08 — Fixed whole-page scroll on owner routes (sidebar now stays fixed)

**Shipped**
- `frontend/src/app/(owner)/layout.tsx`: outer wrapper changed from `min-h-screen` to `h-screen overflow-hidden`, and `<main>` gained `h-full min-h-0 overflow-y-auto` — `min-h-screen` let the whole row (sidebar included) grow past the viewport on any content-heavy page, so the browser scrolled the entire page instead of just the content column. `min-h-0` alongside `flex-1 overflow-y-auto` is the standard fix for flex items' implicit `min-height: auto`, which otherwise silently defeats `overflow-y-auto` by letting the item grow instead of scrolling — `main` needed it since it's also internally `flex-col` from the earlier route-loader fix.
- `frontend/src/components/owner-sidebar.tsx`: `<aside>` gained explicit `h-full`. No overflow handling added deliberately — per instruction, a sidebar that can't fit on a very short viewport is a flagged-but-not-solved edge case, not something to silently clip.
- Checked for an existing `h-dvh` convention before picking a height unit — none exists anywhere in this codebase (`min-h-screen` is the only pattern in use, here and in `public-sidebar.tsx`), so used `h-screen` to match rather than introducing a new convention unprompted.
- Mobile: the bottom tab bar (`owner-mobile-nav.tsx`) was already `position: fixed`, so it was never actually affected by this bug and needed no change — confirmed this by reasoning (fixed positioning anchors to the viewport regardless of ancestor overflow/scroll state, since no ancestor sets `transform`/`filter` to create a new containing block) and then empirically (bounding box identical before/after scrolling). The mobile top header, which *was* an ordinary in-flow element and would have scrolled away under the old bug, is fixed for free by the same `main`-only-scrolls change — no separate edit needed.

**Verified**
- `npx tsc --noEmit`, `npx eslint` clean.
- Live browser pass via Playwright against a throwaway business seeded with 40 bookings (to force genuine scroll) and a short viewport: confirmed `window.scrollY`/`document.documentElement.scrollTop`/`document.body.scrollTop` all stay `0` while `main.scrollTop` moves independently; confirmed the sidebar's and the Sign-out button's bounding boxes are pixel-identical before and after scrolling 800px of content, not just "looked right" in a screenshot. Separately reproduced the validation-banner case (Availability, all days closed) at a very short viewport and confirmed `document.body.scrollHeight` never exceeds `window.innerHeight` while `main.scrollHeight > main.clientHeight` — the extra banner height is absorbed by `main`'s own scroll, not the page. Confirmed the mobile bottom nav's bounding box is also unchanged across a content scroll. Screenshotted both the resting and scrolled states on the Bookings list to visually confirm the header row itself scrolls out of view while the sidebar doesn't move at all.

**Blocking fixes**
- None — this session's whole job was the one bug described above.

**Open questions**
- None.

**Next up**
- Same as previous entries.

## 2026-08-08 — Settings width, Share width regression, and a real validation-messaging bug

**Shipped**
- Settings' form card bumped from `max-w-xl` (576px) to `max-w-2xl` (672px) — checked against Share & Embed first rather than guessing a value: Share was already at `max-w-2xl`, so this converges the two "narrow content" screens onto one shared width instead of introducing a third value. Share itself needed no width change.
- **Found and fixed a real regression while verifying the width bump**: increasing Settings' `max-w` had no visible effect at first — measured its rendered width directly (`getComputedStyle`/`offsetWidth`) rather than trusting a screenshot glance, and it was rendering at 413px despite `max-width: 672px` being correctly applied. Root cause: the previous session's fix to `(owner)/layout.tsx` (making `<main>` a flex column, for the route-loader centering fix) means every direct child of `<main>` is now a flex item — and `mx-auto`'s auto margins disable flexbox's default cross-axis `stretch` for that item, so a plain block wrapper with no explicit width falls back to content-based sizing instead of actually filling out to its `max-width`. Fixed by adding `w-full` alongside `mx-auto max-w-*` on both Settings' and Share's wrapper divs (`w-full` + `max-w-*` + `mx-auto` is the standard combination for this exact situation: fill available space, then cap it, then center the capped box).
- **Share & Embed was already exhibiting the same underlying bug**, just not visibly — its wrapper happened to render at the correct 672px anyway, but only because one of its cards contains a `whitespace-nowrap` span (the raw booking URL) wide enough to force the flex item's content-based width up near 672px by accident, not because the layout was actually structurally correct. Settings has no equivalent wide unwrapped content (its booking URL is a real `<input>`, which has a small fixed intrinsic width regardless of its value), so it had nothing to accidentally hide the bug behind. Fixed Share the same way for real correctness rather than leaving it working by coincidence. Confirmed no other owner screen uses this `mx-auto` pattern (grepped all six `page.tsx` files), so this was the full extent of it.
- **Availability's "all days closed" validation showed a misleading toast**, and the persistent banner meant to cover that exact case had actually never rendered at all, for a second reason underneath the first: `useFieldArray` + a whole-array zod `.refine()` puts its error message at `errors.days.root.message`, not `errors.days.message` — confirmed by instrumenting the component temporarily and logging the real runtime error shape rather than assuming (`{"days":{"root":{"message":"You must have at least one open day for customers to book.","type":"custom"}}}`), then removing the debug logging once confirmed. Fixed the property path, and changed `onInvalid` to only fire the "fix the highlighted fields" toast when `errors.days` actually contains per-index field errors (an array with real entries) — the zero-days-open case has nothing to highlight, so it now relies solely on the corrected persistent banner, which already carried the schema's own exact wording.

**Verified**
- `npx tsc --noEmit`, `npx eslint` clean.
- Live browser pass via Playwright: reproduced the original all-closed bug first (toast present, banner absent, confirmed via page text) to have a true before/after; after the fix, confirmed the reverse (banner present with the exact schema message, toast absent) and separately confirmed the ordinary per-field path still toasts correctly (toggled a day open, set an invalid end time, confirmed the toast fires and the banner does not). Confirmed both Settings' and Share's rendered widths directly (`offsetWidth`) before and after the `w-full` fix, not just visually. Dark mode checked on both the widened Settings card and the corrected banner.

**Blocking fixes**
- The `<main>`-flex-column / `mx-auto` width regression and the `errors.days.root` banner bug were both found during this session's own verification work, not left for later — see above.

**Open questions**
- None.

**Next up**
- Same as the previous two entries.

## 2026-08-08 — Two consistency fixes across owner dashboard routes

**Shipped**
- **Route-transition loader, root-caused rather than papered over.** Audited all 7 existing `loading.tsx` files first — they were byte-for-byte identical (no drift to reconcile), so the top-alignment bug wasn't inconsistent implementations, it was a genuine layout bug shared by all of them: `(owner)/layout.tsx`'s `<main>` had `flex-1` (sizing itself as a flex *item* of the outer sidebar row) but was never `display: flex` itself, so `flex-1 items-center justify-center` inside every `loading.tsx` had no flex context to center within and just collapsed to the spinner's own size at the top of the page. Fixed at the root: `<main>` is now also `flex flex-col`. Verified the fix directly via `getComputedStyle` in a live browser session (`display: flex`, `flexDirection: column`) rather than just asserting the CSS should work.
- New `frontend/src/components/route-loading.tsx` — the same markup every route already had, now defined once and imported by all 8 `loading.tsx` files (`(owner)/loading.tsx`, `dashboard/loading.tsx`, and one per subroute) instead of copy-pasted.
- Added the one missing `loading.tsx`: `dashboard/bookings/page.tsx` had none, silently falling back to the group-level file. Full coverage now.
- **Header spacing audit, done before any changes** (findings shared with the user first, not guessed at): six screens had three different effective subtitle-to-content gaps (16px on Dashboard/Bookings/Share via `gap-4` alone, 24px on Availability/Settings via a clean `mb-6`, and a ~48px compounding bug on Booking form where `mb-6` on the subtitle got trapped inside a flex item *and* the outer `gap-6` added again on top of it — margins on a flex item's children don't collapse out through the item the way normal block margins do, so the two values stacked instead of overlapping). Standardized all six on `mb-1` (h1 → subtitle) + `mb-6` (subtitle → content), restructuring each page so the header block sits outside any `gap-*` wrapper — its own margin is the only thing producing that gap, with a separate inner wrapper preserving each screen's existing inter-section rhythm untouched.

**Verified**
- `npx tsc --noEmit`, `npx eslint` clean.
- Live browser pass via Playwright: screenshotted all six header screens in sequence to confirm identical visual rhythm (previously-buggy Booking form now matches the others exactly), confirmed `<main>`'s computed flex styles directly, and confirmed both in light and dark mode. Could not reliably capture the transient spinner mid-navigation in a screenshot — Next.js prefetches sidebar `<Link>`s in the background, so by the time a click fires the RSC payload is already cached and no loading state ever renders long enough to catch; tried both `setTimeout`-delayed route interception and CDP-level network throttling, neither reliably beat prefetch. Relying on the computed-style proof instead, which verifies the actual root-cause mechanism directly rather than an emergent timing-dependent symptom of it.

**Blocking fixes**
- None — the two bugs this entry describes (the `<main>` flex-context bug, the Booking form margin-compounding bug) were the fixes themselves, not incidents hit while building something else.

**Open questions**
- None.

**Next up**
- Same as the previous entry — public booking page, `widget.js`, and logo upload/file-type fields remain the known unbuilt pieces.

## 2026-08-08 — Dashboard Home screen (reversing the earlier "no separate home" decision)

Reversing the earlier decision to skip Dashboard Home — /dashboard no longer redirects to /dashboard/bookings, it now renders a real landing screen (greeting, stat cards, recent bookings, setup status, quick link to Share & Embed). Original decision is preserved in DEVLOG history for context; this supersedes it.

**Shipped**
- `frontend/src/app/(owner)/dashboard/{page,loading,greeting,stat-cards,recent-bookings-card,setup-status-card,get-more-bookings-card}.tsx` — greeting (time-of-day + owner's first name), three stat cards, a recent-bookings list, a setup-status nudge, and a static "get more bookings" card.
- One call each to `GET /owner/business`, `GET /owner/bookings` (unfiltered, page 1 — its `counts` covers all three stat cards and its `bookings` covers the recent list, so this single call does both jobs rather than fetching twice), `GET /owner/availability`, and `GET /owner/form`, reusing the existing `BookingCounts`/`BookingListItem`/`AvailabilityDay`/`FormField` types from each screen's own lib module rather than re-typing anything.
- "Approved" stat is the plain all-time `counts.approved` total, not a "this week" figure — checked whether deriving "this week" from the already-fetched page-1-of-25 bookings would be accurate, and it wouldn't (older approved-this-week rows can already be pushed off page 1 by newer bookings of any other status sorted ahead of them, so it would silently undercount rather than being visibly wrong). Not worth faking precision the backend doesn't back up.
- Setup status reads real data: "Availability set" from `availability.some(day => day.isAvailable)`, "Booking form customized" from `fields.length > 3`. Corrected one detail in the original brief while implementing this: only Name and Email are actually `isProtected` in the registration seed (`backend/src/routes/auth.ts`) — Phone is a required default but not protected — so "three protected defaults" isn't quite accurate, though the `length > 3` heuristic still works for the common case regardless.
- Greeting reflects the visitor's own local clock, not the server's — a small client component (`greeting.tsx`) seeds a fixed "morning" default (identical on server render and first client paint, avoiding a hydration mismatch) and corrects itself from `new Date().getHours()` in a `useEffect` after mount. Same pattern already used by `use-theme.ts` and the sidebar's collapse state, not a new one.
- **Found and fixed a real sidebar bug while adding the nav item**: `owner-sidebar.tsx`'s `isActive()` did a `startsWith` prefix match, which is correct for every existing item but breaks the moment `/dashboard` itself becomes a nav target — `/dashboard` is a literal prefix of every other route, so it would've shown as permanently active on every owner page. Fixed by adding an `exact` flag, set only on the new Dashboard entry; verified explicitly in browser testing that Dashboard is active on `/dashboard` and *not* active on `/dashboard/bookings` (and vice versa), since this is exactly the kind of thing that silently regresses.
- Added "Dashboard" to `owner-mobile-nav.tsx`'s hamburger dropdown (above Settings) — not asked for directly (the brief scoped this to "sidebar"), but with the redirect gone, mobile users would otherwise have had zero path to this screen at all. Bottom tab bar left untouched (already at its practical limit).
- Fixed two Base UI `nativeButton` console warnings in my own new code (`recent-bookings-card.tsx`'s empty-state action, `get-more-bookings-card.tsx`) by passing `nativeButton={false}` on both `Button render={<Link/>}` usages — same underlying issue already present in `bookings/page.tsx` before this session (not touched, out of scope), but not worth propagating further in newly-authored files when the fix is one prop.

**Verified**
- `npx tsc --noEmit`, `npx eslint` clean.
- Live browser pass via Playwright against a throwaway business: confirmed the empty/incomplete states first (zero stat counts, `EmptyState` in the recent-bookings card, both setup rows muted-and-clickable) on a fresh registration with nothing set up, then set availability, added a form field, and seeded five bookings across pending/approved/rejected directly via Prisma (no public booking-submission flow needed for this) — confirmed all three sections flip to their real-data states, confirmed a recent-bookings row click navigates to the correct `/dashboard/bookings/[id]`, confirmed stat counts matched exactly (2 pending / 2 approved / 5 total). Sidebar active-state bug fix confirmed on two different routes. Mobile hamburger dropdown confirmed to show the new Dashboard entry. Light and dark mode both checked. No console errors after the `nativeButton` fix.

**Blocking fixes**
- The two bugs listed above (sidebar active-state, `nativeButton` warnings) were caught and fixed during this session, not left for later.

**Open questions**
- None — both things flagged for confirmation before building (the "Approved" stat's source, how setup-status is actually determined) were resolved during planning per the reasoning above.

**Next up**
- All spec-listed owner screens are now built. Remaining known gaps: the public booking page (`/book/[businessId]`) and `widget.js` (pointed at by Share & Embed and Settings, not yet built), and logo upload / file-type form fields (logged in `docs/FUTURE_IMPROVEMENTS.md`'s "File Uploads & Storage" section).

## 2026-08-07 — Settings (Business Profile) screen

**Shipped**
- `frontend/src/app/(owner)/dashboard/settings/{page,loading,settings-form}.tsx` — the last unbuilt screen from the spec's original owner build order. Built at `/dashboard/settings`, not the frontend spec's literal `/dashboard/profile` — the sidebar and mobile nav (`owner-sidebar.tsx:35`, `owner-mobile-nav.tsx:52`) already pointed at `/dashboard/settings`, so that's the real route, confirmed before writing any code rather than trusting the spec's route name.
- Business name and Booking URL render as genuinely `disabled` `Input`s (checked via `.isDisabled()` in browser testing, not just a visual class), each with a `Lock` icon next to the label and helper text below. Booking URL reuses `{origin}/book/{business.id}` — same UUID-based formula as Share & Embed's Section A, confirmed identical for the same business via a live comparison during testing, not just matching code by inspection.
- **`getOrigin()` extracted to `frontend/src/lib/origin.ts`**, since this is its second use — it previously lived as a private function inside `share/page.tsx`. `share/page.tsx` now imports it instead of defining its own copy; behavior unchanged, confirmed by re-testing that screen after the move.
- PATCH payload is a named object literal (`{ description, phone, contactEmail, websiteUrl }`), never a spread of broader form state — the backend 400s if `name` or `slug` are merely *present* in the body, not just changed (`owner.ts:62`), so the payload has to structurally exclude them, not just leave them unedited. Verified by intercepting the actual outgoing `PATCH` request in the browser test and confirming those two keys are absent, not just unchanged.
- Success toast uses the backend's own `{ message: 'Business profile updated successfully.' }` verbatim (`owner.ts:75`) — read the route rather than assumed, same pattern as every other mutation this session.
- Plain `useState` per field, no react-hook-form/zod — decision 15 reserves the form library for the two "genuinely complex" forms (availability grid, form builder); this is a flat single-card form, same shape as `register-form.tsx` and the Form Builder's `title-description-form.tsx`, both of which use plain state. Native `type="email"`/`type="url"` for the free structural checks decision 4 allows — confirmed no custom URL-format regex exists anywhere in this codebase today (client or server) before deciding not to invent one here either.
- Phone/Contact email trimmed and normalized to `null` when blank (all four editable columns are nullable in `schema.prisma`) rather than persisting whitespace or empty strings.

**Login-email question, answered before building (per the brief's explicit ask)**
- Not adding a dedicated login-email display to this screen. `owner-sidebar.tsx` already renders `business.owner.email` persistently in the identity block at the bottom of the sidebar on every owner screen, including this one — visible in every screenshot taken during this session's testing without any extra work. A second copy on this specific page would be redundant with something already permanently on-screen.
- Kept the "Shown to customers — separate from your login email" helper text under Contact email regardless, since the distinction is real: `contactEmail` (business column, customer-facing, editable here) and `owner.email` (the `User` row's login credential, not editable here) are genuinely different fields in the schema, confirmed by reading `GET /owner/business`'s response shape.

**Verified**
- `npx tsc --noEmit`, `npx eslint` clean on new and edited files.
- Live browser pass via Playwright against a throwaway business (registered with initial phone/description/website so the pre-fill path had real data to show, not just empty fields; `contactEmail` deliberately left unset at registration — that field isn't even collected by `/auth/register` — so the test also covered filling it in for the first time; deleted afterward, `AF Architects` untouched): confirmed disabled-field DOM state, confirmed the Booking URL matches Share & Embed's exactly for the same business, confirmed pre-filled values match what was registered, edited and saved all four fields, confirmed the toast's exact wording, confirmed via a direct `GET /owner/business` call afterward that `name`/`slug` were unchanged while the four edited fields persisted, confirmed the captured `PATCH` request body's exact key set. Light and dark mode both checked. No console errors.

**Blocking fixes**
- None.

**Open questions**
- None — both questions the brief raised (login email placement, booking-URL slug-vs-UUID wording) were resolved during planning and confirmed correct during testing; see above.

**Next up**
- Dashboard Home (`/dashboard`) is still just a `redirect("/dashboard/bookings")` stub, not a real overview screen — the one piece of the owner area's original spec-listed screens without a real implementation now that Settings is done. The public booking page (`/book/[businessId]`) and `widget.js` remain the other unbuilt pieces the Share & Embed and Settings screens both point at.

## FUTURE_IMPROVEMENTS.md — new "File Uploads & Storage" section

Logged that logo upload (Business Profile) and file-type booking-form fields both require object storage plus a new multipart upload endpoint — neither exists, and neither is a variation on the existing PATCH pattern. Full wording in `docs/FUTURE_IMPROVEMENTS.md`. Deferred, not forgotten — flagged now while building the screen that would eventually host a logo upload, rather than left to be rediscovered later.

## 2026-08-07 — Share & Embed screen

**Doc correction needed on UC10** (same category as the earlier 404/403 fix): UC10's own text describes Section B as an "iframe HTML snippet" and its technical notes talk about iframe height/auto-resize. That's superseded by the frontend spec's decision 6, which is explicit that the real mechanism is a `<script>` tag opening a modal overlay, specifically because a plain iframe gets squeezed by whatever layout surrounds it on the host page. Built to decision 6, not UC10's literal wording on this one point — UC10 should be updated to match.

**Shipped**
- `frontend/src/app/(owner)/dashboard/share/{page,loading,copy-button,embed-snippet,qr-section,qr-error-boundary,test-booking-page-button}.tsx` — booking link, embed snippet, and QR code, at the route the sidebar (`owner-sidebar.tsx`, `owner-mobile-nav.tsx`) already pointed at.
- Business UUID comes from `GET /owner/business` (already selects `id`; the owner layout calls the same endpoint once already, but can't hand typed data into a specific nested page beyond opaque `children`, so this page does its own additive fetch — same pattern every other owner screen already uses). Public booking URL confirmed as `{origin}/book/{business.id}` by reading `GET /public/businesses/:businessId` directly (`where: { id: businessId }`, the raw UUID, not the slug).
- No public-origin env var existed (checked `.env.local` and grepped `src/` for `NEXT_PUBLIC_`/`APP_URL` — nothing). Rather than inventing one, `page.tsx` derives the origin from the incoming request via `headers()` (`x-forwarded-proto` if a reverse proxy set it, falling back to `NODE_ENV`-based scheme, plus `host`) — zero config, can't drift from wherever this actually deploys.
- Embed snippet is fixed dark regardless of the app's own theme toggle (confirmed with the user before building — code blocks read as an editor surface, not a themed page element) using literal hex values borrowed from the existing dark palette, not tokens — the one deliberate exception to "never write a raw colour value," documented the same way the 2026-08-04 toast-position deviation was.
- `qrcode.react`'s `QRCodeCanvas` added (matches UC10's own technical note). QR download reads the canvas via a ref and `.toDataURL("image/png")` — no extra library needed. E1 (QR generation failure) wrapped in a real class-component error boundary (`qr-error-boundary.tsx`) scoped to just the canvas — a plain try/catch around JSX doesn't catch a child's render-time throw, only an error boundary does — so Sections A and B stay completely unaffected if the QR fails; the Download button also hides itself via an `onError` callback lifted out of the boundary, rather than sitting there doing nothing.
- "Test booking page" diverges from UC10's literal telling on purpose (per explicit instruction): UC10 has the *public page itself* show the A1 "hasn't set availability" message once a customer lands on it, but `/book/[businessId]` doesn't exist in the frontend yet, so the check happens here instead — `GET /owner/availability` fired at click time (not speculatively on page load, since this page doesn't otherwise need it), and a persistent dismissible banner with a link to `/dashboard/availability` shown if no day has `isAvailable: true`. A failed check falls back to opening the tab anyway rather than blocking the primary action over a helper check.
- Onboarding checklist (UC10 step 6) confirmed out of scope — grepped `frontend/src`, `backend/src`, and `schema.prisma` for "onboarding": zero matches anywhere in the codebase. Not building a stub with nothing to attach to.
- Flagging a mockup/spec conflict rather than silently picking one: the task brief specified `p-5` (20px) card padding, but the design spec's Cards & panels section fixes all card padding at 16px project-wide, and 20px isn't in the spacing scale at all. Built with `p-4` (16px), matching every other card already shipped (availability's day cards, the form builder's cards).

**Verified**
- `npx tsc --noEmit`, `npx eslint` clean on all new files.
- Live browser pass via Playwright against a throwaway business (registered, admin-approved, logged in through the real `/login` UI; deleted afterward — see Blocking fixes for a wrinkle in that cleanup; `AF Architects` untouched): origin derivation confirmed correct (`http://localhost:3000/book/{uuid}` in dev); Section A copy confirmed via `navigator.clipboard.readText()`, not just the toast; Section B snippet copy confirmed the same way, independent of toggling the page's own theme; QR canvas confirmed to actually contain drawn pixel data (not just "an element exists") and the downloaded file confirmed as a real 160×160 PNG via `file`; "Test booking page" confirmed to show the A1 banner with zero availability set (no popup opened) and to open a real new tab to the exact Section A URL once availability was set via a direct `PUT /owner/availability` call. Both light and dark mode checked on everything except the intentionally-fixed embed block.
- Noticed but did not fix (pre-existing, unrelated to this screen): a Base UI console warning from `bookings/page.tsx`'s `Button render={<Link .../>}` pattern (`nativeButton` prop expects a real `<button>`), surfaced during this session's browser testing because the sidebar prefetches that route. Not touched — out of scope for this screen.

**Blocking fixes**
- First screenshot of the QR section came back blank — turned out to be a test-timing artifact (the screenshot was taken before the client component finished hydrating and drawing the canvas), not a real bug; confirmed by reading the canvas's actual pixel data via `getImageData`, which showed the QR was drawn correctly all along. No code change needed, just a slower test.
- `backend/scripts/deleteTestUsers.ts` doesn't delete `availability_rules`, so cleanup 500'd with a FK-constraint error once this session's test business had availability set (a scenario the Availability-screen session's cleanup never hit, since it deleted before saving real rows on a business other sessions also touched). Deleted the orphaned `availability_rules` rows for the one test business via a one-off temp script (written, run, and removed) rather than editing the shared gitignored tool; flagging the gap here rather than patching a script outside this task's scope.

**Open questions**
- Toast copy for both copy actions ("Link copied" / "Snippet copied") is proposed wording — UC10 doesn't specify exact copy for either.
- `data-business-id` on the `<script>` tag is a placeholder attribute name; `widget.js` itself doesn't exist yet (decision 6: vanilla JS served from `/public`, separate work) and may expect a different attribute name once it's actually built — this snippet will need updating to match at that point.
- "Test booking page" links to a route that will 404 until `/book/[businessId]` is built, per the spec's own build order. Expected, not a gap in this screen.

**Next up**
- Business Profile is still the one unbuilt screen from the spec's original owner-area build order; Dashboard Home (`/dashboard`) is also still just a `redirect("/dashboard/bookings")` stub rather than a real overview screen, unchanged this session — worth flagging since it's easy to assume "shipped" from the sidebar alone. The public booking page (`/book/[businessId]`) and `widget.js` are the two pieces of unbuilt work this session's screen points at but doesn't itself build.

## 2026-08-07 — Form Builder screen

**Shipped**
- `frontend/src/lib/form-builder.ts` + `dashboard/form/{page,loading,title-description-form,form-builder-client,field-row,field-edit-form,options-editor,add-field-panel,preview-panel}.tsx`: the dynamic booking-form editor (UC8, spec screen 10). Title/description editor at top (plain state, its own `PUT /owner/form`), field list left / add-field panel right. Field add/edit/delete/reorder each fire their own request immediately — confirmed against the actual endpoints in `backend/src/routes/owner.ts` (separate `POST`/`PATCH`/`DELETE`/`PUT .../reorder`, no batching transaction) rather than trusting UC8's narrative "Save Form" step, which predates the endpoint-level split.
- Editing pattern is Option C: clicking a non-protected row expands it in place (`bg-surface-1`, indented under the drag-handle width) into a scoped `useForm(zodResolver(...))` instance — one per expanded row, reused identically for both add and edit. Protected fields (Name, Email — confirmed via the registration seed in `backend/src/routes/auth.ts`, `isProtected: true` on exactly those two; Phone is required but **not** protected) render a lock icon, no handle, not clickable, no edit/delete affordance at all.
- `fieldType` turned out to be immutable after creation — `PATCH /form/fields/:id` 400s if it's present in the body — so the expanded row's Type select is only interactive while adding a new field; editing an existing one shows it disabled. Not in the original task brief; found by reading the route.
- No server-side duplicate-label or empty-options check exists anywhere in `owner.ts`, confirming both must be fully client-side: duplicate-label compares trimmed/lowercased against every sibling field (including protected ones); A2's copy ("Add at least one option for this dropdown") is adapted per actual type rather than hardcoded, since showing "dropdown" on a checkbox field would read as a bug.
- Reorder uses `dnd-kit` (`@dnd-kit/core` + `/sortable` + `/utilities`, newly added — nothing drag-related existed in the dependency tree). Every row participates in `useSortable` (so protected rows still animate out of the way when displaced) but only non-protected rows get the drag `listeners`, attached to a `GripVertical` handle rather than the row itself. Drag is disabled screen-wide while any row is expanded. `onDragEnd` reorders local state optimistically and rolls back on a failed `PUT .../reorder`.
- "Preview form" renders the in-memory field list as a static, read-only projection in the right column (toggled in place of the add-field panel) — the real public booking page (`/book/[businessId]`) doesn't exist in the frontend yet, so this was a deliberate scope call made with the user before building rather than guessed.

**Verified**
- `npx tsc --noEmit` clean on all new files (pre-existing `.next/types/validator.ts` route-typing noise is unrelated). `npx eslint` clean after one fix (see Blocking fixes).
- Full live browser pass via Playwright (`chromium-cli` wasn't available in this environment; a local `playwright` install substituted, chromium launched headless) against a throwaway business registered through the real `/auth/register` → admin-approved → logged in through the real `/login` UI, not a mocked session. Confirmed end-to-end, not just rendered: adding a dropdown field with two options persists (`POST` → toast → still present after a fresh page load, cross-checked directly against `GET /owner/form`); the duplicate-label block and the adapted A2 copy both fire inline, not as toasts; clicking a protected row is a genuine no-op; editing an existing field shows its Type select disabled; both a keyboard-driven reorder (Space/Arrow/Space) and a real synthetic mouse drag change the order on screen **and** persist through `PUT /owner/form/fields/reorder`, verified against the API afterward rather than trusting the DOM. Both light and dark mode screenshotted at each step — token usage held up, no raw-color leaks, `surface-1`/`surface-2` distinction correct on the expanded row in both modes. No console errors in any run. Test business (user id 57, "Form Builder QA Co") deleted afterward via the existing gitignored `backend/scripts/deleteTestUsers.ts`; "AF Architects" untouched.

**Blocking fixes**
- `DndContext` needs an explicit `id` prop — without one, dnd-kit's internal id counter produced different values on the server render vs. the client hydration pass, throwing a real React hydration-mismatch warning caught during the first browser test. Fixed with `id="form-builder-dnd"`.
- The drag handle's own `onKeyDown` didn't stop propagation, so pressing Space to pick up a row for a keyboard-driven drag also bubbled up to the row's `onKeyDown` (Enter/Space → expand), firing both at once. First reorder test moved nothing but silently expanded the row instead; fixed by stopping propagation and manually delegating to dnd-kit's own `onKeyDown` handler.

**Open questions**
- Toast copy for field add/edit/delete ("Field added to your booking form" / "Field updated" / "Field deleted") and the duplicate-label inline message ("A field with this label already exists") are my own proposed wording — neither UC8 nor the frontend spec gives exact copy for these, only for the title/description save ("Your booking form has been updated", used verbatim).
- Preview form's in-page-panel behavior was a scope call made with the user for this session; worth revisiting once the public booking page exists, since a true live preview would be more faithful.

**Next up**
- Business Profile is now the only unbuilt screen left in the spec's owner-area build order (Availability, Bookings, and Form Builder are all shipped).

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
