# Orbis Scheduler — Development Log

Running record of what shipped each session. Newest entries at the top.

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