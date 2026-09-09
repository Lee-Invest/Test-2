/**
 * ApexFund Risk Engine
 * =====================
 * A pure, deterministic module implementing the evaluation-challenge rules:
 * daily loss limits, max overall loss/drawdown, profit targets, minimum
 * trading days, and phase transitions.
 *
 * All monetary values are integer CENTS to avoid floating point drift.
 * All percentages are plain numbers, e.g. 5 means 5%.
 *
 * ---------------------------------------------------------------------------
 * FORMULAS (see docs/RISK_ENGINE.md for the full write-up)
 * ---------------------------------------------------------------------------
 *
 * Daily reset:
 *   Each account has a `dailyResetTimeUtc` ("HH:mm") on its template. A new
 *   "trading day" begins the first time an evaluation runs at/after that
 *   time on a calendar date later than the account's `dayStartAt`. At the
 *   moment a new day begins, we snapshot:
 *     dayStartBalanceCents = currentBalanceCents (realized balance only,
 *                             NOT equity — floating trades don't count
 *                             towards the previous day's close)
 *   This snapshot is the baseline for that day's daily-loss calculation.
 *
 * Daily loss:
 *   dailyLossCents = dayStartBalanceCents - min(currentEquityCents, currentBalanceCents-at-eval-time... )
 *   Concretely, at any moment during the trading day:
 *     worstValue = min(currentBalanceCents, currentEquityCents)
 *     dailyLossCents = max(0, dayStartBalanceCents - worstValue)
 *     dailyLossPctUsed = dailyLossCents / startingBalanceCents * 100
 *   Using the *lower* of balance and equity means a breach is detected
 *   whether it happens on realized (closed-trade) losses or on floating
 *   (open-trade / unrealized) losses — matching how real prop firms treat
 *   intraday drawdown.
 *   Breach condition: dailyLossPctUsed >= maxDailyLossPct.
 *
 * Max overall loss (drawdown from the high-water mark):
 *   worstValue = min(currentBalanceCents, currentEquityCents)
 *   overallLossCents = max(0, highestBalanceCents - worstValue)
 *   overallLossPctUsed = overallLossCents / startingBalanceCents * 100
 *   Breach condition: overallLossPctUsed >= maxOverallLossPct.
 *   `highestBalanceCents` is a running high-water mark of realized balance
 *   only (it only ratchets up when a trade closes in profit), and never
 *   decreases.
 *
 * Profit target:
 *   profitCents = currentBalanceCents - startingBalanceCents
 *   profitPct = profitCents / startingBalanceCents * 100
 *   Target met when profitPct >= phaseProfitTargetPct AND the minimum
 *   trading days requirement is also satisfied.
 *
 * Minimum trading days:
 *   A "trading day" counts once per calendar day (in the account's reset
 *   timezone) that has at least one CLOSED trade. Determined by counting
 *   distinct closedAt dates (bucketed at the daily reset boundary).
 *
 * Phase transitions:
 *   PHASE_1 passed  -> PHASE_2 starts with the SAME starting balance as
 *                      Phase 1 (a fresh evaluation of the same account size).
 *   PHASE_2 passed  -> FUNDED starts, again with the same starting balance.
 *   Any breach (daily or overall) at any phase -> phase & account FAILED.
 *
 * Payout calculation (funded stage):
 *   traderShareCents = round(profitCents * profitSplitTraderPct / 100)
 *   firmShareCents   = profitCents - traderShareCents
 */

export interface RiskRules {
  maxDailyLossPct: number;
  maxOverallLossPct: number;
  profitTargetPct: number;
  minTradingDays: number;
}

export interface AccountState {
  startingBalanceCents: number;
  currentBalanceCents: number;
  currentEquityCents: number;
  highestBalanceCents: number;
  dayStartBalanceCents: number;
  tradingDaysCompleted: number;
}

export type RiskEventType =
  | "DAILY_LOSS_BREACH"
  | "MAX_LOSS_BREACH"
  | "PROFIT_TARGET_HIT"
  | "MIN_DAYS_MET";

export interface RiskEventShape {
  type: RiskEventType;
  message: string;
  metadata: Record<string, unknown>;
}

export interface RiskEvaluation {
  worstValueCents: number;
  dailyLossCents: number;
  dailyLossPctUsed: number;
  dailyLossRemainingPct: number;
  dailyLossBreached: boolean;
  overallLossCents: number;
  overallLossPctUsed: number;
  overallLossRemainingPct: number;
  overallLossBreached: boolean;
  profitCents: number;
  profitPct: number;
  profitTargetMet: boolean;
  minTradingDaysMet: boolean;
  phasePassed: boolean;
  breached: boolean;
  events: RiskEventShape[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Core evaluation: given current account state + phase rules, compute all
 * risk metrics and determine breach / pass conditions. Pure function — no
 * I/O, no dates-as-now, fully deterministic and unit-testable. */
export function evaluateRisk(
  state: AccountState,
  rules: RiskRules
): RiskEvaluation {
  const {
    startingBalanceCents,
    currentBalanceCents,
    currentEquityCents,
    highestBalanceCents,
    dayStartBalanceCents,
    tradingDaysCompleted,
  } = state;

  if (startingBalanceCents <= 0) {
    throw new Error("startingBalanceCents must be positive");
  }

  const worstValueCents = Math.min(currentBalanceCents, currentEquityCents);

  // Daily loss
  const dailyLossCents = Math.max(0, dayStartBalanceCents - worstValueCents);
  const dailyLossPctUsed = round2(
    (dailyLossCents / startingBalanceCents) * 100
  );
  const dailyLossBreached = dailyLossPctUsed >= rules.maxDailyLossPct;

  // Overall loss (drawdown from high-water mark)
  const overallLossCents = Math.max(0, highestBalanceCents - worstValueCents);
  const overallLossPctUsed = round2(
    (overallLossCents / startingBalanceCents) * 100
  );
  const overallLossBreached = overallLossPctUsed >= rules.maxOverallLossPct;

  // Profit target (based on realized balance)
  const profitCents = currentBalanceCents - startingBalanceCents;
  const profitPct = round2((profitCents / startingBalanceCents) * 100);
  const profitTargetMet = profitPct >= rules.profitTargetPct;

  const minTradingDaysMet = tradingDaysCompleted >= rules.minTradingDays;

  const breached = dailyLossBreached || overallLossBreached;
  const phasePassed = !breached && profitTargetMet && minTradingDaysMet;

  const events: RiskEventShape[] = [];
  if (dailyLossBreached) {
    events.push({
      type: "DAILY_LOSS_BREACH",
      message: `Daily loss limit breached: ${dailyLossPctUsed}% used (limit ${rules.maxDailyLossPct}%)`,
      metadata: { dailyLossCents, dailyLossPctUsed, limitPct: rules.maxDailyLossPct },
    });
  }
  if (overallLossBreached) {
    events.push({
      type: "MAX_LOSS_BREACH",
      message: `Max overall loss breached: ${overallLossPctUsed}% used (limit ${rules.maxOverallLossPct}%)`,
      metadata: { overallLossCents, overallLossPctUsed, limitPct: rules.maxOverallLossPct },
    });
  }
  if (!breached && profitTargetMet) {
    events.push({
      type: "PROFIT_TARGET_HIT",
      message: `Profit target reached: ${profitPct}% (target ${rules.profitTargetPct}%)`,
      metadata: { profitCents, profitPct, targetPct: rules.profitTargetPct },
    });
  }
  if (!breached && minTradingDaysMet) {
    events.push({
      type: "MIN_DAYS_MET",
      message: `Minimum trading days met: ${tradingDaysCompleted}/${rules.minTradingDays}`,
      metadata: { tradingDaysCompleted, minTradingDays: rules.minTradingDays },
    });
  }

  return {
    worstValueCents,
    dailyLossCents,
    dailyLossPctUsed,
    dailyLossRemainingPct: round2(Math.max(0, rules.maxDailyLossPct - dailyLossPctUsed)),
    dailyLossBreached,
    overallLossCents,
    overallLossPctUsed,
    overallLossRemainingPct: round2(Math.max(0, rules.maxOverallLossPct - overallLossPctUsed)),
    overallLossBreached,
    profitCents,
    profitPct,
    profitTargetMet,
    minTradingDaysMet,
    phasePassed,
    breached,
    events,
  };
}

/** Parses "HH:mm" into minutes-since-midnight (UTC). */
function parseResetTime(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Returns the UTC "trading day" bucket key (YYYY-MM-DD) that `date` falls
 * into, given a daily reset time. A timestamp before the reset time on a
 * given calendar date belongs to the previous day's bucket. */
export function tradingDayKey(date: Date, dailyResetTimeUtc: string): string {
  const resetMinutes = parseResetTime(dailyResetTimeUtc);
  const minutesOfDay = date.getUTCHours() * 60 + date.getUTCMinutes();
  const bucket = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  if (minutesOfDay < resetMinutes) {
    bucket.setUTCDate(bucket.getUTCDate() - 1);
  }
  return bucket.toISOString().slice(0, 10);
}

/** Determines whether `now` has crossed into a new trading day relative to
 * `dayStartAt`, per the configured daily reset time. */
export function hasCrossedDailyReset(
  dayStartAt: Date,
  now: Date,
  dailyResetTimeUtc: string
): boolean {
  return tradingDayKey(dayStartAt, dailyResetTimeUtc) !== tradingDayKey(now, dailyResetTimeUtc);
}

/** Counts distinct trading-day buckets among a list of trade close timestamps. */
export function countTradingDays(
  closedAtDates: Date[],
  dailyResetTimeUtc: string
): number {
  const buckets = new Set(closedAtDates.map((d) => tradingDayKey(d, dailyResetTimeUtc)));
  return buckets.size;
}

// ---------------------------------------------------------------------------
// Trading statistics
// ---------------------------------------------------------------------------

export interface TradeLike {
  pnlCents: number | null;
}

export interface TradingStats {
  totalTrades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  grossProfitCents: number;
  grossLossCents: number; // positive number representing total losses
  profitFactor: number | null; // null when grossLossCents === 0 and no losses
  avgWinCents: number;
  avgLossCents: number; // positive number
  netPnlCents: number;
}

export function computeTradingStats(trades: TradeLike[]): TradingStats {
  const closed = trades.filter((t) => t.pnlCents !== null) as {
    pnlCents: number;
  }[];
  const wins = closed.filter((t) => t.pnlCents > 0);
  const losses = closed.filter((t) => t.pnlCents < 0);

  const grossProfitCents = wins.reduce((s, t) => s + t.pnlCents, 0);
  const grossLossCents = Math.abs(losses.reduce((s, t) => s + t.pnlCents, 0));
  const netPnlCents = closed.reduce((s, t) => s + t.pnlCents, 0);

  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRatePct: closed.length > 0 ? round2((wins.length / closed.length) * 100) : 0,
    grossProfitCents,
    grossLossCents,
    profitFactor: grossLossCents > 0 ? round2(grossProfitCents / grossLossCents) : grossProfitCents > 0 ? null : 0,
    avgWinCents: wins.length > 0 ? Math.round(grossProfitCents / wins.length) : 0,
    avgLossCents: losses.length > 0 ? Math.round(grossLossCents / losses.length) : 0,
    netPnlCents,
  };
}

// ---------------------------------------------------------------------------
// Payout calculation
// ---------------------------------------------------------------------------

export interface PayoutCalculation {
  profitCents: number;
  traderShareCents: number;
  firmShareCents: number;
}

export function calculatePayout(
  startingBalanceCents: number,
  currentBalanceCents: number,
  profitSplitTraderPct: number
): PayoutCalculation {
  const profitCents = Math.max(0, currentBalanceCents - startingBalanceCents);
  const traderShareCents = Math.round((profitCents * profitSplitTraderPct) / 100);
  const firmShareCents = profitCents - traderShareCents;
  return { profitCents, traderShareCents, firmShareCents };
}

// ---------------------------------------------------------------------------
// Pricing / coupon calculation
// ---------------------------------------------------------------------------

export interface CouponLike {
  type: "PERCENT" | "FIXED";
  value: number; // percent (0-100) if PERCENT, cents if FIXED
  active: boolean;
  expiresAt?: Date | null;
  maxRedemptions?: number | null;
  timesRedeemed?: number;
}

export interface PriceCalculation {
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  couponValid: boolean;
  reason?: string;
}

export function applyCoupon(
  priceCents: number,
  coupon: CouponLike | null | undefined,
  now: Date = new Date()
): PriceCalculation {
  if (!coupon) {
    return { subtotalCents: priceCents, discountCents: 0, totalCents: priceCents, couponValid: false };
  }
  if (!coupon.active) {
    return { subtotalCents: priceCents, discountCents: 0, totalCents: priceCents, couponValid: false, reason: "Coupon inactive" };
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) {
    return { subtotalCents: priceCents, discountCents: 0, totalCents: priceCents, couponValid: false, reason: "Coupon expired" };
  }
  if (
    coupon.maxRedemptions != null &&
    (coupon.timesRedeemed ?? 0) >= coupon.maxRedemptions
  ) {
    return { subtotalCents: priceCents, discountCents: 0, totalCents: priceCents, couponValid: false, reason: "Coupon redemption limit reached" };
  }

  let discountCents = 0;
  if (coupon.type === "PERCENT") {
    discountCents = Math.round((priceCents * coupon.value) / 100);
  } else {
    discountCents = Math.round(coupon.value);
  }
  discountCents = Math.min(discountCents, priceCents);
  const totalCents = priceCents - discountCents;

  return { subtotalCents: priceCents, discountCents, totalCents, couponValid: true };
}
