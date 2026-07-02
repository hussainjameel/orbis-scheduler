# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

Orbis Scheduler is a university capstone project (Torrens Australia, ITA602) built by a two-person team on a fixed trimester timeline. See [docs/TIMELINE.md](docs/TIMELINE.md) for the week-by-week plan. As of the current week, only the backend skeleton exists (Express app boots, DB schema is migrated) — the route/middleware files are intentionally empty stubs waiting to be implemented, and there is no frontend yet (Next.js frontend is planned for a later week).

Don't be surprised by "empty" files under `backend/src/routes/` and `backend/src/middleware/` — they are placeholders (0 bytes), not missing/broken code.

## Repository layout

- `backend/` — the only code so far. Express + TypeScript API, Prisma/PostgreSQL.
- `database/` — schema design docs, kept in sync with `backend/prisma/schema.prisma` by hand:
  - `db_schema.dbml` — dbdiagram.io source (source of design intent, includes notes/indexes).
  - `db_schema.sql` — plain SQL DDL equivalent.
  - Note: the DBML currently documents a couple of `users` columns (`reset_token`, `reset_token_expires_at`) that are not yet in `schema.prisma` — that's planned work, not a bug.
- `docs/` — project management artifacts (timeline, use cases, ERD, API endpoint docs as .docx/.pdf).

## Commands

All commands run from `backend/`:

```
npm run dev      # start API with nodemon + ts-node (watches src/index.ts)
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
- we're doing tenant isolation via JWT businessId, not URL params
- `AvailabilityRule`s — weekly recurring slot templates (day of week + start/end/break times + slot duration), used to compute bookable slots on demand (no pre-generated slot rows).
- `BookingForm`s — a business defines a dynamic form (title + `FormField`s: text/textarea/dropdown/checkbox/radio) that public customers fill out.
- `Booking`s — a customer's submission against a form + business, with a status lifecycle (`pending` → `approved`/`rejected`/`cancelled`) and free-text `BookingFieldValue`s for each dynamic form field.

Businesses themselves have an `approvalStatus` (`pending`/`approved`/`rejected`) — an admin must approve a business before its public booking form goes live, separate from booking-level approval.

**Planned route structure** (see the commented-out mounts in `backend/src/index.ts`): the API is split by audience —
- `/auth` — login/register/JWT issuance.
- `/public` — unauthenticated customer-facing endpoints (view a business's public booking page, submit a booking).
- `/owner` — authenticated business-owner endpoints (manage own business, availability, forms, approve/reject bookings). Must enforce tenant isolation (an owner can only touch their own `Business` rows).
- `/admin` — authenticated admin-only endpoints (approve/suspend businesses, platform overview). Gated by `backend/src/middleware/requireAdmin.ts`.

`backend/src/middleware/authenticate.ts` is where JWT verification is intended to live; `backend/src/lib/prisma.ts` exports the shared `PrismaClient` singleton — import this rather than instantiating a new client elsewhere.

## Conventions

- Prisma models are camelCase in `schema.prisma` but `@@map`ped to snake_case tables (e.g. `Business` → `businesses`, `userId` → column `user_id`). Keep new models/fields following this same camelCase-model / snake_case-table pattern, matching `database/db_schema.dbml`.
- `Business.id` and other tenant-scoped foreign keys use UUIDs (`gen_random_uuid()`); most other tables use serial ints. Follow this existing split rather than switching a table's key style.
- `.env` (in `backend/`, gitignored) holds `DATABASE_URL` and `DIRECT_URL` for Prisma.

## Environment variables

`.env` (in `backend/`, gitignored) holds:
- `DATABASE_URL`, `DIRECT_URL` — Prisma/Neon connection strings
- `JWT_SECRET` — signing secret for auth tokens
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` — Nodemailer transport config

## Auth & security conventions

- Passwords hashed with bcrypt, never stored/logged in plain text.
- JWT payload: `{ userId, role }` for admins; `{ userId, role, businessId }` for owners, since owner routes are tenant-scoped by `businessId` from the token, not from URL params.
- Forgot-password responses are intentionally vague ("if that email exists, we've sent a reset link") to prevent email enumeration — don't reveal whether the email was found.
- Owner routes under `/owner` must pass through `requireApprovedBusiness` (business `approvalStatus === 'approved'` and `isActive === true`) in addition to `authenticate` — this is a recurring gate, not a per-route check.
- There is no admin registration route. The single MVP admin user is created via a manual seed script, not through `/auth`.

## Devlog

After completing any feature work (not for trivial fixes/typos), append a dated 
entry to `docs/DEVLOG.md` summarizing what shipped, in the existing format 
(Shipped / any blocking fixes / open questions / next up). Add new entries at 
the top of the file, below the header. Don't ask permission to update this file — 
just do it as the last step of the session.

## Prisma error handling

- Using `@prisma/adapter-neon` (driver adapter) — P2002 errors from this adapter 
  populate `err.meta?.modelName`, not `err.meta?.target` (the latter is undefined 
  on this adapter, unlike vanilla Prisma). Always check `modelName` when catching 
  unique-constraint violations.