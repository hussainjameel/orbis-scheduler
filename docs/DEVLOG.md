# Orbis Scheduler — Development Log

Running record of what shipped each session. Newest entries at the top.

---

## 2026-07-02 — Admin seed script

**Shipped**
- `prisma/seed.ts` — creates exactly one admin `User` (`role: 'admin'`, 
  `isActive: true`, no `Business`/`BookingForm`) from `ADMIN_SEED_EMAIL` / 
  `ADMIN_SEED_PASSWORD` in `.env`. Password is bcrypt-hashed before storage. 
  Implemented as an `upsert` keyed on email, so re-running the seed is a 
  no-op on an existing admin rather than silently resetting their password.
- Registered the seed command in `prisma.config.ts`'s `migrations.seed` 
  field (`tsx prisma/seed.ts`) — Prisma 7's `db seed` reads that, not 
  `package.json`'s `prisma.seed` field (pre-v7 convention; kept as inert 
  documentation alongside it).
- Verified against the live dev DB: ran `npx prisma db seed` twice 
  (idempotent — same user id both runs), checked the row shape directly 
  (`businesses: []`, exactly one admin user total), and logged in via 
  `POST /auth/login` with the seeded credentials to confirm the full path 
  works end to end.

**Open questions / flagged for later**
- Seed password bypasses `/auth/register`'s strength validation entirely 
  (by design — it's an admin-configured credential, not user input via the 
  form), so it isn't guaranteed to meet the same bar enforced elsewhere.

**Next up:** `backend/src/middleware/authenticate.ts` (JWT verification) 
  and the `requireApprovedBusiness` gate for `/owner` routes.

---

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

---

## 2026-07-01 — Register endpoint + environment fixes

**Shipped**
- `POST /auth/register` (`auth.ts`) — validates input, checks duplicate email, 
  hashes password, generates unique slug (numeric-suffix collision handling), 
  and in one transaction creates `User` (role `owner`), `Business` 
  (`approvalStatus: pending`), and default `BookingForm` with Name/Email/Phone 
  fields. Matches UC4. No JWT issued — owner isn't logged in until admin approves.
- `lib/mailer.ts` — best-effort email via Nodemailer, no-ops gracefully when 
  SMTP isn't configured (not set up yet). Registration never blocked by email failure.

**Environment fixes (blocking, unrelated to feature code)**
1. `ts-node` incompatible with Node v24 ESM loader hooks → swapped to `tsx`
2. Prisma 7 requires a driver adapter, not a schema `url` → added 
   `@prisma/adapter-neon` + `@neondatabase/serverless`, wired into `lib/prisma.ts`
3. `dotenv.config()` ran after `authRoutes` import; ESM hoists imports before 
   top-level code → fixed via `import 'dotenv/config'` as first line in `index.ts`

**Open questions / flagged for later**
- `User.resetToken` / `resetTokenExpiresAt` (two columns) vs. use-case doc's 
  `password_reset_tokens` table design — decided to keep two columns (MVP scope, 
  single active token is more secure by default). Resolved.

**Next up:** `/auth/login` — enforce pending/rejected/suspended checks, issue JWT
  ({ userId, role } for admin, { userId, role, businessId } for owner)

---