# CLAUDE.md

Guidance for Claude Code when working in this repository.

This file sits at the repository root and applies to both applications.

## Project status

Orbis Scheduler is a university capstone project (Torrens Australia, ITA602) built by a two-person team on a fixed trimester timeline. See `docs/TIMELINE.md` for the week-by-week plan.

**Backend is feature-complete.** All 29 endpoints built, tested against a live dev database, and merged. Covers auth, tenant isolation, business profile, availability, the dynamic form builder, slot calculation, the full booking lifecycle, and admin platform management.

**Frontend is scaffolded but has no screens yet.** Next.js is installed, the design system is wired into Tailwind, and shadcn/ui is initialised. No routes, forms, or API integration exist yet.

## Repository layout

- `backend/` — Express + TypeScript API, Prisma/PostgreSQL (Neon).
- `frontend/` — Next.js 16 + React 19 + Tailwind v4.
- `database/` — schema design docs, kept in sync with `backend/prisma/schema.prisma` by hand:
  - `db_schema.dbml` — dbdiagram.io source (design intent, includes notes/indexes).
  - `db_schema.sql` — plain SQL DDL equivalent.
- `docs/` — project artifacts: timeline, use cases, ERD, API endpoint reference, `DEVLOG.md`, `FUTURE_IMPROVEMENTS.md`, and the two frontend specifications below.

## Specifications — read these before frontend work

Two documents in `docs/` govern all frontend implementation. Neither is optional context.

**`Orbis_Scheduler_Frontend_Specification.pdf`**
- Every screen (18 across 3 actors), mapped one-to-one against backend endpoints
- Recommended build order
- Fifteen architecture decisions, each with reasoning — data fetching, session storage, route protection, validation scope, notifications, the embed widget, responsive scope, styling, form state, and more

**`Orbis_Scheduler_Design_Specification.pdf`**
- The full palette for both modes, with exact values and usage rules
- Type scale, spacing scale, radius scale
- Component states, patterns (icons, shadows, toasts, empty states, form layout, motion)
- Eight non-negotiable rules

If a frontend decision seems undecided, check these first. Most questions are already answered.

---

# Backend

## Commands

From `backend/`:

```
npm run dev      # start API with tsx watch
npm run build    # tsc compile to dist/
npm start        # run compiled dist/index.js
```

Prisma (also from `backend/`):

```
npx prisma migrate dev    # create/apply a migration
npx prisma generate       # regenerate the client
npx prisma studio         # browse the DB
```

No test runner and no lint script — don't invent one; ask before adding either.

## Architecture

**Multi-tenant scheduling platform.** A `User` (role `owner` or `admin`) owns one or more `Business` records. Each business has:

- `AvailabilityRule`s — weekly recurring templates (day of week, start/end/break times, slot duration), used to compute bookable slots on demand. No pre-generated slot rows.
- `BookingForm`s — a dynamic form (title plus `FormField`s: text/textarea/dropdown/checkbox/radio) that public customers fill out.
- `Booking`s — a customer submission with a status lifecycle (`pending` → `approved`/`rejected`/`cancelled`) and free-text `BookingFieldValue`s per dynamic field.

Businesses have an `approvalStatus` (`pending`/`approved`/`rejected`) — an admin must approve a business before its public booking page goes live. Separate from booking-level approval, and separate from `isActive` (the ongoing suspend/activate toggle).

**Route structure** — one file per API prefix:

- `backend/src/routes/auth.ts` — `/auth` — register, login, forgot/reset password. No auth required.
- `backend/src/routes/public.ts` — `/public` — public business page, slots, booking submission. No auth required.
- `backend/src/routes/owner.ts` — `/owner` — business profile, availability, forms, bookings. Requires `authenticate` + `requireApprovedBusiness`.
- `backend/src/routes/admin.ts` — `/admin` — business approve/reject/suspend/activate, platform stats. Requires `authenticate` + `requireAdmin`.

Tenant identity always comes from the verified JWT (`req.user.businessId`), never from URL params or the request body.

`backend/src/lib/prisma.ts` exports the shared `PrismaClient` singleton — import it rather than instantiating a new client. `backend/src/lib/slots.ts` exports `generateSlots()`, used by both `GET /public/slots` and `POST /public/bookings`. Never duplicate that logic.

## Conventions

- Prisma models are camelCase in `schema.prisma` but `@@map`ped to snake_case tables (`Business` → `businesses`, `userId` → `user_id`). Follow this pattern.
- `Business.id` and other public-facing IDs are UUIDs (`gen_random_uuid()`) — unguessable, so tenants can't be enumerated. Internal-only IDs (`User.id`, `FormField.id`) are serial ints.
- Cross-tenant or nonexistent resource access returns `404`, never `403` — deliberately indistinguishable, so a response never confirms a resource exists on another tenant.
- Local-only dev scripts live in `backend/scripts/` (gitignored) — one-off tooling, not application code.

## Environment variables

`backend/.env` (gitignored):

- `DATABASE_URL`, `DIRECT_URL` — Prisma/Neon connection strings
- `JWT_SECRET` — token signing secret
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Nodemailer (Mailtrap Sandbox in dev)
- `FRONTEND_URL` — used to build links in emails
- `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` — used by `prisma/seed.ts`

## Auth and security

- Passwords hashed with bcrypt (cost 12), never stored or logged in plain text.
- JWT payload: `{ userId, role }` for admins; `{ userId, role, businessId }` for owners.
- Login and forgot-password return identical responses whether or not an account exists — prevents enumeration. `forgot-password` deliberately does not await the email send, to avoid a timing side-channel.
- `/owner` routes pass through `requireApprovedBusiness` on every request, re-checking live DB state — a JWT stays valid 24h even if the business is suspended mid-session.
- There is no admin registration route. Admin users are created via `prisma/seed.ts`.

## Prisma quirks specific to this project

- Using `@prisma/adapter-neon`: `P2002` errors populate `err.meta?.modelName`, not `err.meta?.target` (undefined on this adapter). Always check `modelName` for unique-constraint violations.
- Clearing a nullable `Json` column requires `Prisma.JsonNull`, not plain `null` — they mean different things.
- Partial/filtered unique indexes (with a `WHERE` clause) aren't expressible in `schema.prisma`. These exist as hand-written raw SQL in their migration files only, e.g. `bookings_active_slot_unique`. `schema.prisma` won't show them.
- This environment has no interactive TTY, so `prisma migrate dev` doesn't work. Workaround: `prisma migrate diff` to generate SQL, hand-place it in a correctly-timestamped migration folder, then `prisma migrate deploy`.

---

# Frontend

## Stack

- **Next.js 16** with App Router, TypeScript, `src/` directory
- **React 19**
- **Tailwind CSS v4**
- **shadcn/ui** on **Base UI** primitives
- **Lucide** icons
- **DM Sans** (loaded via `next/font/google`), Geist Mono for code

## Commands

From `frontend/`:

```
npm run dev      # dev server on localhost:3000
npm run build    # production build
npm start        # run the production build
npm run lint     # eslint
```

Backend runs on `5000`, frontend on `3000` — no collision.

## Tailwind v4 — configuration lives in CSS, not a config file

**There is no `tailwind.config.ts`.** v4 moved configuration into CSS. The entire design system is in `src/app/globals.css`, structured in three parts:

1. `:root { }` — light mode raw values
2. `.dark { }` — dark mode raw values, same token names
3. `@theme inline { }` — turns those variables into Tailwind utilities

The `inline` keyword is load-bearing: it keeps the `var()` reference rather than resolving it at build time, which is what allows one utility class to produce two values depending on mode. Without it, dark mode silently does nothing.

Dark mode is class-based via `@custom-variant dark (&:where(.dark, .dark *))`, overriding v4's default `prefers-color-scheme` behaviour so a manual toggle can work.

## Tokens

**Project tokens** (use these):
`surface-0/1/2`, `border-default`, `border-strong`, `text-primary/secondary/muted/disabled`, `brand`, `brand-on`, `brand-subtle`, and the status pairs `pending`/`pending-text`, `approved`/`approved-text`, `rejected`/`rejected-text`, `cancelled`/`cancelled-text`.

**shadcn tokens** (`--primary`, `--card`, `--muted`, `--accent`, `--border`, etc.) are mapped to the project tokens in `globals.css` so shadcn components inherit the palette automatically. Do not use these names in application code — they exist only for component inheritance. Note in particular that `--accent` belongs to shadcn and is a neutral hover colour, not the brand orange.

## shadcn/ui

Components are **copied into the repository**, not installed as a dependency. There is no `shadcn` package in `package.json`. Files live in `src/components/ui/` and are ordinary source code — edit them directly rather than fighting them with overrides.

```
npx shadcn@latest add <component>
```

Adding a component installs its Base UI dependency and writes the file. Components already customised for this project:

- `button.tsx` — radius changed to `rounded-sm` (6px per spec) across all size variants; off-scale `text-[0.8rem]` replaced with `text-sm`

`src/lib/utils.ts` exports `cn()`, which merges class names and resolves Tailwind conflicts via `tailwind-merge`. Every shadcn component uses it. Leave it alone.

## Frontend conventions

- **Never write a raw colour value in a component.** Every colour comes from a theme token. A single hardcoded hex breaks dark mode silently and can't be found by searching for a token name.
- **Never introduce a size outside the scale.** Five type sizes, seven spacing values, two radii (plus `rounded-full` for badges). If something needs an in-between value, the layout is wrong.
- **One brand colour, one purpose.** `brand` marks primary actions and focus rings. Not tabs, links, icons, or decoration.
- **Sentence case everywhere** — labels, headings, buttons, badges, menu items.
- **Two font weights only** — 400 and 500. Hierarchy comes from size, colour, and spacing.
- **Verify both modes before considering a screen done.** Not at the end of the build.

Full reasoning for all of these is in `docs/Orbis_Scheduler_Design_Specification.pdf`.

## Planned structure

Not yet built. Route groups will be:

- `src/app/(public)/` — landing, auth screens, public booking page. No auth.
- `src/app/(owner)/` — dashboard, profile, availability, form builder, bookings. Auth guard in the layout.
- `src/app/(admin)/` — platform overview, business list and detail. Admin-only guard in the layout.

Session handling per decision 9 of the frontend specification: JWT stored in an `httpOnly` cookie set by a Next.js route handler, all browser traffic proxied through Next.js, no backend changes. Route protection per decision 10: verified in each route group's layout, not middleware.

---

# Working practices

## Devlog

After completing any feature work (not trivial fixes or typos), append a dated entry to `docs/DEVLOG.md` in the existing format — Shipped / Verified / Blocking fixes / Open questions / Next up. Newest entries at the top, below the header. Don't ask permission; do it as the last step of the session.

## Future improvements

`docs/FUTURE_IMPROVEMENTS.md` tracks deliberately deferred, out-of-scope items. Add to it whenever a real gap or deferred feature comes up rather than leaving it in conversation only.

## Test data

"AF Architects" is a persistent test business used for manual Postman testing across sessions. It is not leftover data — never delete it or flag it as an unexplained cleanup gap.
