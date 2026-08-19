# Orbis Scheduler

A multi-tenant appointment-booking platform. A business owner registers, gets approved by an admin, sets their weekly availability and a customer-facing booking form, then shares a public booking page (or embeds a booking widget on their own site). Customers book a slot; the owner approves, rejects, or cancels it.

University capstone project (Torrens Australia, ITA602), built by a two-person team on a fixed trimester timeline. Both the backend and frontend are feature-complete — see [`docs/development/IMPLEMENTATION_NOTES.md`](docs/development/IMPLEMENTATION_NOTES.md) for the full build record.

**Live demo:** [orbis-scheduler.vercel.app](https://orbis-scheduler.vercel.app/)

## Tech stack

**Backend** — `backend/`
Express + TypeScript, Prisma ORM on PostgreSQL (Neon serverless), JWT auth, bcrypt password hashing, Nodemailer for transactional email. 30 REST endpoints across `/auth`, `/public`, `/owner`, `/admin`.

**Frontend** — `frontend/`
Next.js 16 (App Router) + React 19 + Tailwind CSS v4, shadcn/ui on Base UI primitives, Lucide icons. Three route groups — public, owner dashboard, admin — each with its own auth guard, plus a standalone embeddable booking-widget script (`widget.js`) other sites can drop in.

Full stack details, conventions, and architecture decisions live in [`backend/README.md`](backend/README.md), [`frontend/README.md`](frontend/README.md), and the root [`CLAUDE.md`](CLAUDE.md).

## Repository layout

```
backend/    Express API (see backend/README.md)
frontend/   Next.js app (see frontend/README.md)
docs/       specs, ERD, API reference, devlog, use cases — indexed in docs/README.md
businesses/ standalone HTML fixtures for manually testing the embed widget cross-origin
```

## Running locally

Requires Node 24.x, a PostgreSQL database (the project uses Neon), and two terminals.

**1. Backend** — from `backend/`:

```bash
npm install
npx prisma generate
npm run dev      # http://localhost:5000
```

Needs a `.env` (gitignored) — see [`backend/README.md`](backend/README.md#getting-started) for the full variable list (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, SMTP\_\*, `FRONTEND_URL`, `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD`).

**2. Frontend** — from `frontend/`:

```bash
npm install
npm run dev      # http://localhost:3000
```

Needs a `.env.local` (gitignored) with `BACKEND_URL` and `JWT_SECRET` (must match the backend's) — see [`frontend/README.md`](frontend/README.md#getting-started).

Ports don't collide (`5000` vs `3000`), so both run side by side.

## Demo data & testing the widget

To get realistic, already-approved businesses with a live booking form, availability, and bookings across every status (safe to re-run — skips businesses that already exist), from `backend/`:

```bash
npx tsx scripts/seedDemoBusinesses.ts
```

To manually test `widget.js` — the embeddable booking popup — cross-origin (the same way a real third-party site would load it), with the backend and frontend both already running:

```bash
npx serve businesses -p 4321   # from the repo root
```

Then open **http://localhost:4321/af-architects.html** or **http://localhost:4321/second-business.html** — two standalone pages simulating third-party business websites, each with a real embed snippet. Port `4321` vs. the frontend's `3000` is what makes it a genuine cross-origin test; opening the HTML files directly (`file://`) doesn't trigger the same browser behavior and isn't representative. Full details in [`businesses/README.md`](businesses/README.md).

## Deployment

**Frontend → Vercel.** Root directory set to `frontend/`. Build/start commands are Next.js's defaults (`next build` / `next start`). Environment variables: `BACKEND_URL` (pointing at the deployed backend) and `JWT_SECRET` (must match the backend).

**Backend → Render.** A Node web service rooted at `backend/`. Build command `npm install && npm run build` (runs `tsc` to `dist/`, with `postinstall` also running `prisma generate`); start command `npm start` (`node dist/index.js`). Render supplies `PORT` automatically — the app reads it via `process.env.PORT`. Environment variables: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`, `FRONTEND_URL` (the deployed Vercel URL — also used for the API's CORS allow-list), `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD`.

Both platforms deploy on push to `main`; there's no separate staging environment.

## Documentation

- [`CLAUDE.md`](CLAUDE.md) — architecture, conventions, and working practices for both apps (also the guidance file for AI coding agents working in this repo)
- [`docs/README.md`](docs/README.md) — index of specs, ERD, API reference, use cases, devlog, and academic reports
- [`docs/development/IMPLEMENTATION_NOTES.md`](docs/development/IMPLEMENTATION_NOTES.md) — plan vs. reality: what shipped, where it diverged from spec, and why
- [`docs/development/FUTURE_IMPLEMENTATION.md`](docs/development/FUTURE_IMPLEMENTATION.md) — deliberately deferred, out-of-scope items
