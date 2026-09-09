# Remaining work

This session was given a ~76-section, full-platform feature spec (trader
sidebar rebuild, multi-account support, payout center, affiliate/referral
system, rewards/certificates, support center, security/profile/billing
pages, i18n/multi-currency foundations, admin user management, fraud
monitoring, analytics/exports, dark mode, onboarding, background jobs, and
more) against a single working session. That is realistically weeks of
engineering work; this session focused on shipping a small number of
**correct, tested, server-side-enforced** foundations that the rest of the
spec depends on, rather than producing UI shells with no real logic behind
them (which the spec's own rule 75/76 explicitly forbids).

## What was completed this session

1. **`lib/account-state-machine.ts`** (sections 29-30, partial) — an
   explicit allow-list of legal `PhaseStatus` transitions, with an
   admin-override escape hatch that requires a server-verified
   `actorIsAdmin: true` flag. Unit tested. Deliberately reuses the existing
   `PhaseStatus` enum on `ChallengePhase` rather than introducing a second,
   competing `AccountStatus` field (per the spec's own instruction not to
   duplicate status tracking).
2. **`lib/phase-advance.ts` — `checkAndAdvancePhase(accountId)`** (section
   30) — invoked from `GET /api/dashboard` on every account load. Persists
   breach → `FAILED` and `phasePassed` → next-phase transitions (Phase 1 →
   Phase 2 → Funded), creates the next `ChallengePhase` row with a rules
   snapshot (mirroring the existing admin `SET_PHASE` action), writes
   `RiskEvent` + `Notification` rows, and does all of it inside a
   `prisma.$transaction`. The dashboard now shows an "Account Failed" banner
   referencing the actual `RiskEvent` message (section 28's breach-banner
   requirement).
3. **`lib/payout-eligibility.ts` — `checkPayoutEligibility()`** (sections
   31-37, partial) — single source of truth for payout eligibility: funded
   status, min trading days, min payout amount (new
   `ChallengeTemplate.minPayoutCents`), payout cycle elapsed (new
   `ChallengeTemplate.payoutCycleDays`), no open breach, no existing open
   payout request. Returns `{ eligible, reasons[] }` and is used by **both**
   `GET` (so the dashboard can show why a request is blocked) and `POST`
   `/api/payouts` — no duplicated logic. "No open positions" is checked and
   documented as an always-true no-op, since the mock trading engine has no
   concept of a live order book (as the spec anticipated).
4. **Payout schema/status extensions** — `PayoutStatus` gained
   `UNDER_REVIEW`, `PROCESSING`, `CANCELLED`, `AVAILABLE`; `Payout` gained
   `rejectionReason` (required, validated server-side via zod's `.refine`,
   when the admin action is `REJECT`). Migration:
   `prisma/migrations/20260909225031_payout_center_status_config`.
5. **Admin payout review** now returns full context per payout (trader,
   account, template, prior payouts, last 20 risk events) in one response,
   runs the status update + `AuditLog` + trader `Notification` in one
   `prisma.$transaction`, and sends a Notification on every
   approve/reject/paid/status-change action.
6. Tests: `lib/account-state-machine.test.ts`,
   `lib/payout-eligibility.test.ts` (16 new tests, all passing; 41 total
   vitest tests pass). `npx tsc --noEmit`, `npm run lint`, and a full
   `env -i ... npm run build` with **no** `DATABASE_URL` set all pass
   cleanly (verifying no route regressed the prerender-against-missing-DB
   failure class called out in the project history).

## Not started — fully deferred

Everything else in the spec (sections 24-27 sidebar/multi-account UI,
38-39 refunds/coupons admin, 40-41 affiliate system, 42-43
rewards/certificates, 44-46 support center/notification bell/email
templates, 47-49 security/profile/billing pages, 50-51
currency/i18n foundations, 52-53 admin user mgmt/audit log viewer, 54-58
risk alerts/open positions/trading restrictions/connection page, 59
background jobs, 60 fraud monitoring, 61-63 analytics/exports/search, 64-65
dark mode/mobile audit, 66-69 empty states/onboarding/activity log, 70
settings center, 71-72 transaction/idempotency audit beyond payouts) was
**not implemented** in this session. No placeholder pages, mock data, or
non-functional UI was added for any of these — per the project's core rule,
it is better to ship nothing for a feature than to ship a page that looks
real but has no backing logic.

### Suggested order for a follow-up session

Given the dependency chain the spec itself describes, pick up in this
order:

1. **Sidebar shell + multi-account switcher** (24-25) — this is the
   navigational skeleton every other trader-facing page in the list
   attaches to; build it before any of sections 26-58's "own page" items,
   or you'll be retrofitting navigation into a dozen pages later.
2. **Account details page + daily-loss widget** (26-28) — mostly wiring:
   the server-side math already exists in `lib/risk-engine.ts` and is now
   exposed via `/api/dashboard`; this is a display task, filter trades by
   `closedAt` date range server-side for today/weekly/monthly P/L.
3. **Payout center UI** (31-37 UI half) — the eligibility/backend half is
   done; build the trader-facing page consuming `GET /api/payouts`'s new
   `eligibility` array, and the admin detail-expand modal consuming the new
   per-payout context from `GET /api/admin/payouts`.
4. **Refunds + coupons admin** (38-39) — `applyCoupon()` in
   `lib/risk-engine.ts` already handles active/expired/redemption-limit
   checks; extend it (don't duplicate) for min-order-amount and
   template/account-size restrictions, then build the admin Coupons tab and
   an Orders/Refunds tab.
5. **Affiliate/referral** (40-41), **rewards/certificates** (42-43),
   **support center + notification bell** (44-46) — each is a self-contained
   vertical slice (new models + a couple of routes + a page); do them in any
   order once the sidebar shell exists.
6. **Security/Profile/Billing** (47-49) — straightforward CRUD against
   `User`, needs new `passwordChangedAt`, profile fields, and a
   `LoginEvent` model (wire login-event logging into the NextAuth
   `authorize()` callback in `lib/auth.ts`).
7. Everything else (50-76) — lower priority per the spec's own ordering;
   currency/i18n and dark mode are architecture-only per the spec's own
   scoping language ("foundations only, not full i18n" / "pick ONE
   approach"), background jobs and fraud checks are best-effort/no-real-infra
   by the spec's own admission, and the final sections (71-76) are
   audits/checklists to run once the above exists, not new features.

### Specific gaps worth calling out explicitly

- **`Account.orderId` uniqueness** (section 72): confirmed already
  `@unique` in the existing schema (`orderId String? @unique` on `Account`)
  and `lib/provisioning.ts`'s `if (order.account) return order.account;`
  guard already makes `provisionOrder()` idempotent — this was verified,
  not newly built, and needs no further work.
- **`checkAndAdvancePhase`** only fires when `GET /api/dashboard` is called
  for a given account. There is no cron in this deployment (per the spec's
  own section 59 acknowledgment) — a trader who never opens the dashboard
  after breaching will not get a `RiskEvent`/`Notification` until they do.
  This is the same "lazy evaluation on read" pattern the spec explicitly
  asked for in lieu of real scheduler infrastructure.
- **Local dev**: this environment has no outbound TCP to the production
  Neon database. All schema/migration work here was generated and verified
  against local Postgres per the project's own instructions
  (`DATABASE_URL="postgresql://postgres:postgres@localhost:5432/apexfund"`
  in the gitignored `.env`). The new migration
  (`20260909225031_payout_center_status_config`) applies cleanly to a fresh
  database via `npx prisma migrate deploy` and was verified end-to-end with
  `npx tsx prisma/seed.ts`.

## How to verify what's here

```bash
sudo service postgresql start
sudo -u postgres psql -c "CREATE DATABASE apexfund;"   # if not already created
# .env: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/apexfund"
npx prisma migrate deploy
npx tsx prisma/seed.ts
npm test            # 41 tests, including the 16 new ones
npx tsc --noEmit
npm run lint
env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production npm run build
npm run dev
# log in as trader@apexfund.example / Trader123!Demo, open /dashboard,
# and request a payout on a funded seeded account to exercise the new
# eligibility service end-to-end via the UI + POST /api/payouts.
```
