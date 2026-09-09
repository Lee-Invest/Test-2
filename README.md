# ApexFund

A production-ready MVP of a two-step evaluation prop-trading challenge
platform — traders buy a challenge, pass Phase 1 and Phase 2 under
configurable risk rules, and get funded with a profit split. "ApexFund" is a
placeholder brand — swap [`lib/branding.ts`](./lib/branding.ts) to re-skin
the whole app.

This is an MVP built to demonstrate the full architecture end-to-end, not a
pixel-perfect clone of any real company. All copy, colors, and code are
original. See "What was deliberately simplified" below.

## Architecture overview

- **Framework**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Database**: PostgreSQL via Prisma ORM (see [`prisma/schema.prisma`](./prisma/schema.prisma))
- **Auth**: NextAuth (Auth.js) v4, credentials provider, bcrypt-hashed
  passwords, JWT sessions, role-based middleware (`TRADER` / `ADMIN` /
  `SUPER_ADMIN`)
- **Risk engine**: pure, deterministic TypeScript module
  ([`lib/risk-engine.ts`](./lib/risk-engine.ts)), fully unit tested — see
  [`docs/RISK_ENGINE.md`](./docs/RISK_ENGINE.md) for the exact formulas
- **Payments**: Stripe Checkout Sessions + signature-verified webhook that
  provisions accounts on `checkout.session.completed`
- **Trading data abstraction**: [`lib/trading-engine/`](./lib/trading-engine)
  defines a `TradingEngineAdapter` interface; a `MockTradingEngineAdapter`
  backs the MVP so a real broker integration can be swapped in later without
  touching calling code

## Folder structure

```
app/                      Next.js App Router pages & API routes
  api/                     Route handlers (auth, checkout, webhooks, admin, dashboard)
  admin/                   Admin dashboard (templates, accounts, payouts, analytics)
  dashboard/               Trader dashboard
  (marketing pages)        /, /pricing, /how-it-works, /faq, /rules, /about, /contact,
                           /terms, /privacy, /risk-disclosure
components/                Shared UI (nav, footer, legal page shell)
lib/
  risk-engine.ts           Core risk/pricing/stats calculations (pure, tested)
  risk-engine.test.ts      Vitest suite for the risk engine
  phase-transition.ts      Phase sequencing helper
  auth.ts                  NextAuth configuration
  authz.ts                 requireAdmin / requireUser server-side guards
  prisma.ts                Prisma client singleton
  stripe.ts                Stripe client
  provisioning.ts          Order -> Account/Phase provisioning logic
  validation.ts            Zod schemas for all API input
  rate-limit.ts            In-memory rate limiter (see production note below)
  branding.ts              Single source of truth for brand name/colors
  trading-engine/          Broker abstraction + mock adapter
prisma/
  schema.prisma            Full data model
  migrations/              Versioned SQL migrations (applied with `migrate deploy`)
  seed.ts                  Seed script (templates, admin, demo trader + trades)
docs/
  RISK_ENGINE.md           Full formula reference for the risk engine
```

## Local development

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL at minimum
npx prisma migrate deploy   # applies the versioned migrations in prisma/migrations
npx prisma db seed          # seeds templates, admin user, demo trader + trades
npm run dev                 # http://localhost:3000
```

If you change `prisma/schema.prisma` during development, generate a new
migration with `npx prisma migrate dev --name <what-changed>` (interactive,
local only) and commit the resulting `prisma/migrations/*` folder.

### Tests

```bash
npm test                    # runs the risk-engine vitest suite (26 tests)
```

### Type checking & linting

```bash
npx tsc --noEmit
npm run lint
```

### Build

```bash
npm run build
```

`npm run build` succeeds without a live database — API routes that read the
database are marked `force-dynamic` so they aren't statically prerendered at
build time; they need `DATABASE_URL` set at runtime to actually serve data.

## Demo credentials (from `prisma/seed.ts`)

| Role   | Email                       | Password         |
|--------|-----------------------------|-------------------|
| Admin  | admin@apexfund.example      | `Admin123!Change` |
| Trader | trader@apexfund.example     | `Trader123!Demo`  |

Change these before any real deployment. The seed script also prints them to
the console when it runs.

## Environment variables

See [`.env.example`](./.env.example) for the full list:
`DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `EMAIL_*`. No real secrets
are committed anywhere in the repo — only obvious placeholders in
`.env.example`.

## Security notes

- Passwords are hashed with bcrypt (cost factor 12); never stored in plain text.
- Every mutation of balance, phase, or payout status goes through a
  server-side, role-checked API route (`/api/admin/*`) or the Stripe webhook
  handler — there is no trader-writable endpoint for these fields.
- All API input is validated with Zod (`lib/validation.ts`) before touching
  the database.
- The Stripe webhook verifies the `stripe-signature` header against
  `STRIPE_WEBHOOK_SECRET` before trusting any event payload.
- `middleware.ts` protects `/dashboard/**` (any signed-in user) and
  `/admin/**` (ADMIN/SUPER_ADMIN only) at the edge.
- `lib/rate-limit.ts` is an in-memory fixed-window limiter — **it only works
  for a single server process.** In production (multiple instances /
  serverless), replace it with a shared store such as Redis (e.g. Upstash),
  keeping the same `rateLimit(key, limit, windowMs)` interface.

## Deploying to Vercel

1. **Import the repo**: Vercel → New Project → Import this repository, and
   pick the branch you want to deploy.
2. **Database**: provision a hosted Postgres — [Neon](https://neon.tech) or
   [Supabase](https://supabase.com) both have a free tier that works fine
   for this project — and copy its connection string.
3. **Environment variables** (Project Settings → Environment Variables), see
   `.env.example` for the full list:
   - `DATABASE_URL` — the hosted Postgres connection string
   - `NEXTAUTH_SECRET` — generate with `openssl rand -base64 32`
   - `NEXTAUTH_URL` — your Vercel domain, e.g. `https://your-app.vercel.app`
   - `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` —
     test-mode keys from your Stripe dashboard
4. **Deploy.** The `build` script runs `prisma generate && next build` (see
   note below on why), so the Prisma Client is always regenerated fresh —
   no extra Vercel build-command configuration is needed.
5. **Apply migrations and seed** against the hosted database — from your
   machine, with `DATABASE_URL` pointed at the same hosted Postgres:
   ```bash
   npx prisma migrate deploy
   npx prisma db seed
   ```
6. **Stripe webhook**: in the Stripe dashboard, add an endpoint pointing to
   `https://your-app.vercel.app/api/webhooks/stripe` for the
   `checkout.session.completed` event, and copy its signing secret into
   `STRIPE_WEBHOOK_SECRET`.

**Two Vercel-specific gotchas already handled in this repo** (kept here so
they don't get "fixed" back into breakage):
- `"build": "prisma generate && next build"` — Vercel's install step can
  skip third-party lifecycle scripts (`postinstall`/`preinstall`), which
  silently leaves Prisma's generated client stale. Prisma generate runs
  explicitly as the first step of the build command instead, per
  [Prisma's own Vercel guidance](https://pris.ly/d/vercel-build).
- Every API route that touches Prisma or `getServerSession` exports
  `export const dynamic = "force-dynamic"`. Without it, Next can't always
  detect that a route is request-dependent and may try to prerender it at
  build time — executing a database query against a database that doesn't
  exist on the build machine and failing the build.

## Other production notes

- **Hosting**: any Node host that supports Next.js App Router works, not
  just Vercel.
- **Email**: replace `lib/mailer.ts`'s console.log stub with a real
  nodemailer transport (or a transactional email API) using the `EMAIL_*`
  env vars.
- **Rate limiting**: swap `lib/rate-limit.ts` for a Redis-backed
  implementation before scaling beyond a single instance.

## What was deliberately deferred or simplified

Given the scope of a full prop-firm platform, this MVP prioritizes a
complete, working vertical slice over exhaustive feature coverage:

- **No live broker/market data integration.** Trades are seeded/simulated
  via `lib/trading-engine/mock-adapter.ts`, which implements the same
  `TradingEngineAdapter` interface a real broker adapter would.
- **No calendar-view component** was built for daily P/L (the trade history
  table with date/symbol/side filters covers the same underlying data).
- **Stripe checkout** is fully wired (session creation + signature-verified
  webhook + order provisioning) but has not been exercised against live
  Stripe test-mode network calls in this environment; the webhook signature
  verification and provisioning logic are the parts that matter and are
  implemented per Stripe's documented pattern.
- **Email** is stubbed to `console.log` in dev, as explicitly allowed by the
  brief.
- **Rate limiting** is an in-memory stub, documented above as needing Redis
  in production.
- **UI polish**: the marketing pages, pricing selector, dashboard, and admin
  panel are functional and coherent but intentionally simple — no animation
  library, no full shadcn/ui component set (a minimal hand-rolled equivalent
  using Tailwind directly).
- **Account "reset day"/cron job** for the daily-loss baseline is not
  scheduled as a background job in this MVP; the formula and boundary logic
  are fully implemented and tested in the risk engine, ready to be invoked
  from a scheduled job or on-request check in production.

## Test results

`npm test` → **26/26 passing** (risk engine: daily loss, overall
drawdown/high-water mark, profit target, min trading days, daily-reset
boundaries including a non-midnight reset time, multi-trade same-day
accumulation, floating intraday loss, trading statistics, payout
calculation/rounding, coupon/discount edge cases, phase transitions).

`npx tsc --noEmit` → no errors. `npm run lint` → no errors. `npm run build`
→ succeeds (see note above about DB-dependent routes).
