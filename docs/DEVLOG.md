# Orbis Scheduler — Development Log

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
