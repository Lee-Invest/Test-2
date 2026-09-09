# Risk Engine Reference

The risk engine lives in [`lib/risk-engine.ts`](../lib/risk-engine.ts) as a pure,
deterministic module with no I/O — it takes plain numbers in, and returns plain
numbers/booleans out, so it can be unit tested exhaustively and reused from API
routes, background jobs, or a future broker webhook handler.

All monetary values are **integer cents**. All percentages are plain numbers
(e.g. `5` means 5%).

## Daily reset & trading-day buckets

Each `ChallengeTemplate` has a `dailyResetTimeUtc` field (`"HH:mm"`, default
`"00:00"`). A trading day is a UTC calendar bucket that begins at that time. A
timestamp before the reset time on a given date belongs to the **previous**
day's bucket. This is implemented by `tradingDayKey(date, dailyResetTimeUtc)`.

`hasCrossedDailyReset(dayStartAt, now, dailyResetTimeUtc)` tells the caller
(e.g. a cron job or an on-request check) whether `now` has moved into a new
bucket relative to the account's last recorded `dayStartAt`. When it has, the
caller should snapshot the account's current **realized balance** (not
equity) into `dayStartEquityCents` and advance `dayStartAt` — floating P&L on
open trades does not "count" toward the previous day's close.

## Daily loss

```
worstValue        = min(currentBalanceCents, currentEquityCents)
dailyLossCents    = max(0, dayStartBalanceCents - worstValue)
dailyLossPctUsed  = dailyLossCents / startingBalanceCents * 100
breach            = dailyLossPctUsed >= maxDailyLossPct
```

Using the **lower** of balance and equity means a breach is caught whether it
comes from realized (closed-trade) losses during the day, or from floating
(open-position) losses — matching how real prop firms enforce intraday
drawdown. All loss percentages are calculated against the account's
**starting balance**, not the day's starting balance, which is the standard
convention for prop-firm daily-loss rules.

## Max overall loss (drawdown from high-water mark)

```
worstValue           = min(currentBalanceCents, currentEquityCents)
overallLossCents     = max(0, highestBalanceCents - worstValue)
overallLossPctUsed   = overallLossCents / startingBalanceCents * 100
breach               = overallLossPctUsed >= maxOverallLossPct
```

`highestBalanceCents` is a running high-water mark of **realized balance**
only; it ratchets up whenever a closed trade pushes the balance to a new
high, and never decreases. This means the overall loss limit is a
"trailing" drawdown from the account's best-ever balance, not a fixed floor
under the starting balance — again, standard prop-firm behavior.

## Profit target

```
profitCents  = currentBalanceCents - startingBalanceCents
profitPct    = profitCents / startingBalanceCents * 100
met          = profitPct >= phaseProfitTargetPct
```

Profit target is evaluated on **realized balance**, not equity — an open
floating profit does not count until the trade closes.

## Minimum trading days

A trading day "counts" once it has at least one **closed** trade, bucketed by
the same daily-reset logic above. `countTradingDays(closedAtDates,
dailyResetTimeUtc)` de-duplicates by trading-day key.

## Phase transitions

- `PHASE_1` passed (profit target hit, min days met, no breach) → `PHASE_2`
  starts with the **same starting balance** as Phase 1.
- `PHASE_2` passed → `FUNDED` starts, again with the same starting balance.
- A breach (daily or overall loss) at **any** phase, including `FUNDED`,
  marks the current phase and account `FAILED` immediately — a simultaneous
  profit-target hit does not override a breach (see
  `evaluateRisk().phasePassed`, which requires `!breached`).

See [`lib/phase-transition.ts`](../lib/phase-transition.ts) for the phase
sequence helper.

## Trading statistics

`computeTradingStats(trades)` derives win rate, gross profit/loss, profit
factor (`grossProfit / grossLoss`, `null` when there have been profitable
trades but zero losses, `0` when there have been no trades at all), and
average win/loss size, from a list of `{ pnlCents }` values (open trades with
`pnlCents: null` are excluded).

## Payout calculation

```
profitCents       = max(0, currentBalanceCents - startingBalanceCents)
traderShareCents  = round(profitCents * profitSplitTraderPct / 100)
firmShareCents    = profitCents - traderShareCents
```

Rounding is applied once, to the trader's share, and the firm's share is the
remainder — this guarantees `traderShareCents + firmShareCents ===
profitCents` exactly, with no off-by-one-cent reconciliation issues.

## Coupon / pricing calculation

`applyCoupon(priceCents, coupon, now)` validates a coupon's `active` flag,
expiry, and redemption limit before applying either a `PERCENT` discount
(`round(price * value / 100)`) or a `FIXED` discount (capped at the price so
totals never go negative), returning `{ subtotalCents, discountCents,
totalCents, couponValid, reason? }`.

## Test coverage

See [`lib/risk-engine.test.ts`](../lib/risk-engine.test.ts) for the full
vitest suite (26 tests), covering: exact hits of the daily-loss and
overall-loss limits, floating (unrealized) intraday loss, multiple trades
accumulating within one day, daily-reset boundary edge cases (including a
non-midnight reset time), drawdown computed from a ratcheted high-water mark
rather than the original starting balance, profit-target/min-days
interactions, trading statistics, payout rounding/reconciliation, and coupon
edge cases (expired, redemption-limit-reached, fixed discount capped at
price).
