# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project status

Orbis Scheduler is a university capstone project (Torrens Australia, ITA602) built by a two-person team on a fixed trimester timeline. See docs/TIMELINE.md for the week-by-week plan.

**Backend is feature-complete: all 29 endpoints built, tested against a live dev DB, and merged into `backend`.** This covers auth, tenant isolation, business profile, availability, dynamic form builder, slot calculation, the full booking lifecycle, and admin platform management.

**Frontend has not started yet.** Next.js is planned for the next phase.

## Repository layout

- `backend/` — Express + TypeScript API, Prisma/PostgreSQL (Neon).
- `database/` — schema design docs, kept in sync with `backend/prisma/schema.prisma` by hand:
  - `db_schema.dbml` — dbdiagram.io source (source of design intent, includes notes/indexes).
  - `db_schema.sql` — plain SQL DDL equivalent.
- `docs/` — project management artifacts (timeline, use cases, ERD, API endpoint docs, DEVLOG.md, FUTURE_IMPROVEMENTS.md).

## Commands

All commands run from `backend/`:

```
npm run dev      # start API with tsx watch (watches src/index.ts)
npm run build    # tsc compile to dist/
npm start        # run compiled dist/index.js
```

Prisma (also run from `backend/`):

```
npx prisma migrate dev    # create/apply a migration from schema.prisma changes
npx prisma generate       # regenerate the Prisma client
npx prisma studio         # browse the DB
```

There is no test runner configured yet and no lint script — don't invent one; ask before adding a testing/linting setup.

## Architecture

**Multi-tenant scheduling platform.** A `User` (role: `owner` or `admin`) owns one or more `Business` records. Each business has:

- `AvailabilityRule`s — weekly recurring slot templates (day of week + start/end/break times + slot duration), used to compute bookable slots on demand (no pre-generated slot rows).
- `BookingForm`s — a dynamic form (title + `FormField`s: text/textarea/dropdown/checkbox/radio) that public customers fill out.
- `Booking`s — a customer's submission, with a status lifecycle (`pending` → `approved`/`rejected`/`cancelled`) and free-text `BookingFieldValue`s for each dynamic form field.

Businesses have an `approvalStatus` (`pending`/`approved`/`rejected`) — an admin must approve a business before its public booking page goes live, separate from booking-level approval and separate from `isActive` (the ongoing suspend/activate toggle).

**Route structure** — one file per API prefix:

- `backend/src/routes/auth.ts` — `/auth` — register/login/forgot-reset password. No auth required.
- `backend/src/routes/public.ts` — `/public` — customer-facing: public business page, slots, booking submission. No auth required.
- `backend/src/routes/owner.ts` — `/owner` — business profile, availability, forms, bookings. Requires `authenticate` + `requireApprovedBusiness`.
- `backend/src/routes/admin.ts` — `/admin` — business approve/reject/suspend/activate, platform stats. Requires `authenticate` + `requireAdmin`.

Tenant identity always comes from the verified JWT (`req.user.businessId`), never from URL params or the request body — this is what makes cross-tenant access structurally impossible rather than dependent on a per-route check.

`backend/src/lib/prisma.ts` exports the shared `PrismaClient` singleton — import this rather than instantiating a new client elsewhere. `backend/src/lib/slots.ts` exports `generateSlots()`, the single shared slot-calculation function used by both `GET /public/slots` (browsing) and `POST /public/bookings` (the final availability re-check) — never duplicate this logic.

## Conventions

- Prisma models are camelCase in `schema.prisma` but `@@map`ped to snake_case tables (e.g. `Business` → `businesses`, `userId` → column `user_id`). Keep new models/fields following this pattern.
- `Business.id` and other public-facing IDs use UUIDs (`gen_random_uuid()`) — unguessable, so tenants can't be discovered by stepping through sequential numbers. Internal-only IDs (`User.id`, `FormField.id`, etc.) use serial ints.
- Cross-tenant or nonexistent resource access returns `404`, not `403`, across the whole codebase — deliberately indistinguishable, so a response never confirms a resource exists on another tenant.
- Local-only dev scripts live in `backend/scripts/` (gitignored, never pushed) — one-off cleanup/testing tools, not part of the application.

## Environment variables

`.env` (in `backend/`, gitignored) holds:

- `DATABASE_URL`, `DIRECT_URL` — Prisma/Neon connection strings
- `JWT_SECRET` — signing secret for auth tokens
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Nodemailer transport config (Mailtrap Sandbox in dev)
- `FRONTEND_URL` — used to build links in emails (password reset, etc.)
- `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` — used by `prisma/seed.ts`

## Auth & security conventions

- Passwords hashed with bcrypt (cost factor 12), never stored/logged in plain text.
- JWT payload: `{ userId, role }` for admins; `{ userId, role, businessId }` for owners.
- Login and forgot-password both return identical responses for "doesn't exist" vs. "exists but wrong credentials/no such email" — prevents account enumeration. `forgot-password`'s email send is deliberately not awaited, to avoid a timing side-channel on top of the identical response text.
- `/owner` routes pass through `requireApprovedBusiness` (business `approvalStatus === 'approved'` and `isActive === true`) in addition to `authenticate` on every request — this re-checks live DB state every time, since a JWT stays valid for 24h even if the business is suspended mid-session.
- There is no admin registration route. The MVP admin user(s) are created via `prisma/seed.ts`, not through `/auth`.

## Prisma quirks specific to this project

- Using `@prisma/adapter-neon` (driver adapter): `P2002` errors populate `err.meta?.modelName`, not `err.meta?.target` (the latter is `undefined` on this adapter). Always check `modelName` when catching unique-constraint violations.
- Clearing a nullable `Json` column on update requires `Prisma.JsonNull`, not plain `null` — plain `null` means something different (a JSON `null` value vs. an actual SQL `NULL`).
- Partial/filtered unique indexes (`WHERE` clause) aren't expressible in `schema.prisma`'s `@@unique`/`@@index` syntax. These exist as hand-authored raw SQL in their migration files only (e.g. `bookings_active_slot_unique`) — `schema.prisma` won't show them. Keep this in mind if `prisma db pull`/introspection is ever run.
- This environment has no interactive TTY, so `prisma migrate dev` doesn't work directly. Workaround: `prisma migrate diff` to generate the SQL, hand-place it in a correctly-timestamped migration folder, then `prisma migrate deploy` to apply it non-interactively.

## Devlog

After completing any feature work (not for trivial fixes/typos), append a dated entry to `docs/DEVLOG.md` summarizing what shipped, in the existing format (Shipped / Verified / Blocking fixes / Open questions / Next up). Add new entries at the top of the file, below the header. Don't ask permission to update this file — just do it as the last step of the session.

## Future improvements

`docs/FUTURE_IMPROVEMENTS.md` tracks deliberately deferred, out-of-MVP-scope items. Add to it whenever a real gap or deferred feature comes up — don't let it only live in conversation.
