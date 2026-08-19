# Orbis Scheduler — Frontend

Next.js app for Orbis Scheduler, a multi-tenant appointment-booking platform. Feature-complete: all 16 screens across the public, owner, and admin route groups, wired to the real API, plus an embeddable booking-widget script.

For design-system rationale, architecture decisions, and the two governing specs, see the root [`CLAUDE.md`](../CLAUDE.md) — this file covers day-to-day setup and orientation for this folder only. Also see [`AGENTS.md`](./AGENTS.md) for a Next.js-version note relevant to AI coding agents.

## Stack

- **Next.js 16** (App Router, `src/` directory, TypeScript)
- **React 19**
- **Tailwind CSS v4** — configuration lives in `src/app/globals.css`, there is no `tailwind.config.ts`
- **shadcn/ui** on **Base UI** primitives — components are copied into `src/components/ui/`, not installed as a package
- **Lucide** icons, **DM Sans** + Geist Mono fonts
- `react-hook-form` + `zod` (the two complex forms: availability, form builder), `@dnd-kit/*` (form-field reordering), `qrcode.react` + `react-day-picker` + `date-fns` (share/embed, public booking calendar)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

Backend runs on `5000` — no port collision. Requires a `.env.local` file (gitignored) with:

| Variable | Purpose |
|---|---|
| `BACKEND_URL` | Express API origin, used by the server-side route handlers/proxy |
| `JWT_SECRET` | must match the backend's — used to verify the `httpOnly` session cookie in Server Components/layouts |

## Commands

```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build
npm start        # run the production build
npm run lint     # eslint
```

## Project structure

```
src/
  app/
    (public)/         # landing, login/register/forgot/reset password, public booking page — no auth
    (owner)/dashboard/ # home, bookings (list + detail), availability, form builder, share & embed, settings — auth guard in layout
    (admin)/admin/      # platform overview, business list — admin-only guard in layout
    api/                # Next.js route handlers: /api/auth/* (login/register/forgot/reset/logout) and a generic
                          # /api/[...path] client-mutation proxy that reads the httpOnly cookie server-side and
                          # forwards to the Express API (browser fetch can't read httpOnly cookies directly)
    globals.css          # the entire design system: tokens, light/dark values, @theme inline mapping
  components/
    ui/                  # shadcn/ui primitives, hand-customised (button.tsx radius, text size)
    *.tsx                 # app-level shared components: sidebars/mobile-nav per role, toast system, status badges, etc.
  lib/                    # per-domain API clients and helpers (api.ts server-side fetch, api-client.ts client-side,
                            # session.ts, availability.ts, bookings.ts, form-builder.ts, admin.ts, public-booking.ts, origin.ts)
  hooks/
    use-theme.ts           # dark-mode toggle, matchMedia-backed
public/
  widget.js                # embeddable booking-widget script — Shadow DOM popup modal, OS-dark-mode aware,
                             # dual-mode (auto floating button or window.Orbis.open()/close() for a custom trigger)
```

## Session & route protection

JWT lives in an `httpOnly` cookie set by a Next.js route handler; all browser traffic that needs auth is proxied through Next.js rather than hitting the Express API directly from the client. Each route group's `layout.tsx` (a Server Component) verifies the session itself via `jsonwebtoken` — not Next middleware, since middleware's edge runtime can't run that library.

## Design tokens

Never hardcode a colour or an off-scale size in a component — see the root [`CLAUDE.md`](../CLAUDE.md#tokens) for the full token list and the eight non-negotiable design rules, sourced from [`docs/frontend/design-specification.pdf`](../docs/frontend/design-specification.pdf).

## Further reading

- [`docs/frontend/frontend-specification.pdf`](../docs/frontend/frontend-specification.pdf) — every screen, mapped to backend endpoints, plus the fifteen architecture decisions referenced above
- [`docs/development/IMPLEMENTATION_NOTES.md`](../docs/development/IMPLEMENTATION_NOTES.md) — screen-by-screen record of what shipped, where it diverged from spec, and why
