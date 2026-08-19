# Orbis Scheduler — Backend

Express + TypeScript API for Orbis Scheduler, a multi-tenant appointment-booking platform. Feature-complete: 30 endpoints across auth, tenant isolation, business profile, availability, the dynamic form builder, slot calculation, the full booking lifecycle, and admin platform management.

For architecture rationale, conventions, and Prisma-specific quirks, see the root [`CLAUDE.md`](../CLAUDE.md) — this file covers day-to-day setup and orientation for this folder only.

## Stack

- **Express** + **TypeScript**
- **Prisma** ORM on **PostgreSQL** (Neon serverless, via `@prisma/adapter-neon`)
- **JWT** (`jsonwebtoken`) auth, **bcrypt** password hashing
- **Nodemailer** (Mailtrap Sandbox in dev) for transactional email
- Dev runner: `tsx` via `nodemon`

## Getting started

```bash
npm install
npx prisma generate
npm run dev      # tsx watch, http://localhost:5000
```

Requires a `.env` file (gitignored) with:

| Variable | Purpose |
|---|---|
| `DATABASE_URL`, `DIRECT_URL` | Neon/Prisma connection strings |
| `JWT_SECRET` | token signing secret |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Nodemailer transport (Mailtrap Sandbox in dev) |
| `FRONTEND_URL` | used to build links in emails |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` | consumed by `prisma/seed.ts` |

## Commands

```bash
npm run dev      # start API with tsx watch (nodemon)
npm run build    # tsc compile to dist/
npm start        # run compiled dist/index.js
```

Prisma:

```bash
npx prisma migrate dev    # create/apply a migration (needs a TTY — see CLAUDE.md workaround if not available)
npx prisma generate       # regenerate the client
npx prisma studio         # browse the DB
```

No test runner and no lint script configured — don't invent one; ask before adding either.

## Project structure

```
src/
  index.ts               # app entry, route + middleware wiring
  routes/
    auth.ts               # /auth   — register, login, forgot/reset password (no auth)
    public.ts              # /public — public business page, slots, booking submission (no auth)
    owner.ts               # /owner  — business profile, availability, forms, bookings (authenticate + requireApprovedBusiness)
    admin.ts                # /admin  — approve/reject/suspend/activate businesses, platform stats (authenticate + requireAdmin)
  middleware/
    authenticate.ts         # JWT verification, populates req.user
    requireApprovedBusiness.ts
    requireAdmin.ts
  lib/
    prisma.ts               # shared PrismaClient singleton — import this, never instantiate a new client
    slots.ts                # generateSlots() — shared by GET /public/slots and POST /public/bookings
    mailer.ts                # Nodemailer wrapper, no-ops gracefully when SMTP isn't configured
  types/
    express.d.ts             # Request augmentation (req.user)
prisma/
  schema.prisma              # source of truth for the data model
  migrations/                 # includes hand-written raw SQL for partial unique indexes (not expressible in schema.prisma)
  seed.ts                     # creates the admin user from ADMIN_SEED_EMAIL/PASSWORD
scripts/                       # gitignored, local-only dev tooling — not application code
```

## Data model, in brief

A `User` (role `owner` or `admin`) owns one or more `Business` records. Each business has `AvailabilityRule`s (weekly recurring templates — slots are computed on demand, never pre-generated), a `BookingForm` of dynamic `FormField`s, and `Booking`s with a `pending → approved/rejected/cancelled` status lifecycle. A business also carries its own `approvalStatus` (admin gate on going live), separate from the booking-level status and from `isActive` (suspend/activate).

Full endpoint reference: [`docs/api/api-endpoints.pdf`](../docs/api/api-endpoints.pdf). Schema source of truth: `prisma/schema.prisma`, mirrored by hand in [`docs/database/`](../docs/database/).

## Load-bearing conventions

- Tenant identity always comes from the verified JWT (`req.user.businessId`) — never from URL params or the request body.
- Cross-tenant or nonexistent resource access returns `404`, never `403` — deliberately indistinguishable, so a response never confirms a resource exists on another tenant.
- `@prisma/adapter-neon` puts `P2002` unique-constraint info on `err.meta?.modelName`, not `err.meta?.target`.
- Partial/filtered unique indexes (e.g. `bookings_active_slot_unique`) live only as hand-written raw SQL in their migration files — invisible to `schema.prisma`.

Full reasoning for all of the above — including the Prisma quirks, auth/security model, and known ambiguities resolved during the build — is in the root [`CLAUDE.md`](../CLAUDE.md) and [`docs/development/IMPLEMENTATION_NOTES.md`](../docs/development/IMPLEMENTATION_NOTES.md).
