import { describe, it, expect } from "vitest";
import {
  evaluateRisk,
  tradingDayKey,
  hasCrossedDailyReset,
  countTradingDays,
  computeTradingStats,
  calculatePayout,
  applyCoupon,
  type AccountState,
  type RiskRules,
} from "./risk-engine";
import { nextPhase } from "./phase-transition";

const baseRules: RiskRules = {
  maxDailyLossPct: 5,
  maxOverallLossPct: 10,
  profitTargetPct: 10,
  minTradingDays: 4,
};

const baseState = (overrides: Partial<AccountState> = {}): AccountState => ({
  startingBalanceCents: 10_000_00, // $10,000
  currentBalanceCents: 10_000_00,
  currentEquityCents: 10_000_00,
  highestBalanceCents: 10_000_00,
  dayStartBalanceCents: 10_000_00,
  tradingDaysCompleted: 0,
  ...overrides,
});

describe("evaluateRisk - daily loss", () => {
  it("does not breach when under the daily loss limit", () => {
    const r = evaluateRisk(
      baseState({ currentEquityCents: 9_600_00, currentBalanceCents: 9_600_00 }), // -4%
      baseRules
    );
    expect(r.dailyLossBreached).toBe(false);
    expect(r.dailyLossPctUsed).toBe(4);
  });

  it("detects an exact hit of the daily loss limit (5%)", () => {
    const r = evaluateRisk(
      baseState({ currentEquityCents: 9_500_00, currentBalanceCents: 9_500_00 }), // exactly -5%
      baseRules
    );
    expect(r.dailyLossPctUsed).toBe(5);
    expect(r.dailyLossBreached).toBe(true);
    expect(r.breached).toBe(true);
    expect(r.events.some((e) => e.type === "DAILY_LOSS_BREACH")).toBe(true);
  });

  it("uses the worse of balance vs equity (floating loss intraday)", () => {
    // Balance still flat (no closed trades), but equity down 6% due to an
    // open losing position -> should breach on floating loss alone.
    const r = evaluateRisk(
      baseState({ currentBalanceCents: 10_000_00, currentEquityCents: 9_400_00 }),
      baseRules
    );
    expect(r.dailyLossBreached).toBe(true);
    expect(r.worstValueCents).toBe(9_400_00);
  });

  it("accumulates multiple trades within the same day against the same day-start baseline", () => {
    // Two losing trades close during the day: -200, then -150 -> balance 9650
    let state = baseState();
    // Trade 1
    state = { ...state, currentBalanceCents: 9_800_00, currentEquityCents: 9_800_00 };
    let r = evaluateRisk(state, baseRules);
    expect(r.dailyLossPctUsed).toBe(2);
    // Trade 2 same day (dayStartBalanceCents unchanged)
    state = { ...state, currentBalanceCents: 9_650_00, currentEquityCents: 9_650_00 };
    r = evaluateRisk(state, baseRules);
    expect(r.dailyLossPctUsed).toBe(3.5);
    expect(r.dailyLossBreached).toBe(false);
  });
});

describe("evaluateRisk - overall loss / drawdown", () => {
  it("detects an exact hit of the max overall loss limit (10%)", () => {
    const r = evaluateRisk(
      baseState({
        highestBalanceCents: 10_000_00,
        currentBalanceCents: 9_000_00,
        currentEquityCents: 9_000_00,
        dayStartBalanceCents: 9_500_00, // daily loss only 5.26% below limit boundary check below
      }),
      baseRules
    );
    expect(r.overallLossPctUsed).toBe(10);
    expect(r.overallLossBreached).toBe(true);
  });

  it("computes drawdown from a ratcheted high-water mark, not the starting balance", () => {
    // Account grew to $11,000 high-water mark, then dropped to $9,990 (below
    // the ORIGINAL starting balance, but only ~9.18% off the high-water mark).
    const r = evaluateRisk(
      baseState({
        highestBalanceCents: 11_000_00,
        currentBalanceCents: 9_990_00,
        currentEquityCents: 9_990_00,
        dayStartBalanceCents: 11_000_00,
      }),
      baseRules
    );
    expect(r.overallLossPctUsed).toBe(10.1);
    expect(r.overallLossBreached).toBe(true);
  });
});

describe("evaluateRisk - profit target & phase pass", () => {
  it("detects an exact hit of the profit target (10%) with min days met", () => {
    const r = evaluateRisk(
      baseState({
        currentBalanceCents: 11_000_00,
        currentEquityCents: 11_000_00,
        highestBalanceCents: 11_000_00,
        dayStartBalanceCents: 11_000_00,
        tradingDaysCompleted: 4,
      }),
      baseRules
    );
    expect(r.profitPct).toBe(10);
    expect(r.profitTargetMet).toBe(true);
    expect(r.minTradingDaysMet).toBe(true);
    expect(r.phasePassed).toBe(true);
    expect(r.events.some((e) => e.type === "PROFIT_TARGET_HIT")).toBe(true);
  });

  it("does not pass the phase if min trading days are not met even if profit target is hit", () => {
    const r = evaluateRisk(
      baseState({
        currentBalanceCents: 11_000_00,
        currentEquityCents: 11_000_00,
        highestBalanceCents: 11_000_00,
        dayStartBalanceCents: 11_000_00,
        tradingDaysCompleted: 2,
      }),
      baseRules
    );
    expect(r.profitTargetMet).toBe(true);
    expect(r.minTradingDaysMet).toBe(false);
    expect(r.phasePassed).toBe(false);
  });

  it("a breach overrides a simultaneous profit target hit", () => {
    // Contrived: profit target met on balance, but overall drawdown also
    // breached (e.g. balance up overall but had touched a deep floating dd).
    const r = evaluateRisk(
      baseState({
        currentBalanceCents: 11_000_00,
        currentEquityCents: 11_000_00,
        highestBalanceCents: 12_500_00, // high-water mark far above current
        dayStartBalanceCents: 11_000_00,
        tradingDaysCompleted: 4,
      }),
      baseRules
    );
    expect(r.overallLossBreached).toBe(true);
    expect(r.phasePassed).toBe(false);
  });
});

describe("daily reset boundary", () => {
  it("buckets a timestamp just before reset into the previous day", () => {
    const key1 = tradingDayKey(new Date("2026-01-05T23:59:00Z"), "00:00");
    expect(key1).toBe("2026-01-05");
  });

  it("buckets a timestamp at/after reset into the new day", () => {
    const key = tradingDayKey(new Date("2026-01-06T00:00:00Z"), "00:00");
    expect(key).toBe("2026-01-06");
  });

  it("handles a non-midnight reset time correctly around the boundary", () => {
    // Reset at 17:00 UTC (broker-style 5pm reset)
    const before = tradingDayKey(new Date("2026-01-06T16:59:00Z"), "17:00");
    const after = tradingDayKey(new Date("2026-01-06T17:00:00Z"), "17:00");
    expect(before).toBe("2026-01-05");
    expect(after).toBe("2026-01-06");
  });

  it("detects a crossed daily reset between two timestamps", () => {
    const dayStart = new Date("2026-01-05T01:00:00Z");
    const laterSameDay = new Date("2026-01-05T23:00:00Z");
    const nextDay = new Date("2026-01-06T00:30:00Z");
    expect(hasCrossedDailyReset(dayStart, laterSameDay, "00:00")).toBe(false);
    expect(hasCrossedDailyReset(dayStart, nextDay, "00:00")).toBe(true);
  });
});

describe("trading days counting", () => {
  it("counts distinct trading days across multiple trades, some same-day", () => {
    const dates = [
      new Date("2026-01-05T10:00:00Z"),
      new Date("2026-01-05T14:00:00Z"), // same day as above
      new Date("2026-01-06T09:00:00Z"),
      new Date("2026-01-07T09:00:00Z"),
    ];
    expect(countTradingDays(dates, "00:00")).toBe(3);
  });
});

describe("computeTradingStats", () => {
  it("computes win rate, profit factor, and averages", () => {
    const stats = computeTradingStats([
      { pnlCents: 10000 },
      { pnlCents: -5000 },
      { pnlCents: 20000 },
      { pnlCents: -5000 },
      { pnlCents: null }, // still open, excluded
    ]);
    expect(stats.totalTrades).toBe(4);
    expect(stats.wins).toBe(2);
    expect(stats.losses).toBe(2);
    expect(stats.winRatePct).toBe(50);
    expect(stats.grossProfitCents).toBe(30000);
    expect(stats.grossLossCents).toBe(10000);
    expect(stats.profitFactor).toBe(3);
    expect(stats.avgWinCents).toBe(15000);
    expect(stats.avgLossCents).toBe(5000);
    expect(stats.netPnlCents).toBe(20000);
  });

  it("handles zero losses (profit factor undefined/null-safe)", () => {
    const stats = computeTradingStats([{ pnlCents: 100 }, { pnlCents: 200 }]);
    expect(stats.grossLossCents).toBe(0);
    expect(stats.profitFactor).toBeNull();
  });

  it("handles no trades at all", () => {
    const stats = computeTradingStats([]);
    expect(stats.totalTrades).toBe(0);
    expect(stats.winRatePct).toBe(0);
    expect(stats.profitFactor).toBe(0);
  });
});

describe("calculatePayout", () => {
  it("splits profit 80/20 by default", () => {
    const p = calculatePayout(10_000_00, 12_000_00, 80);
    expect(p.profitCents).toBe(2_000_00);
    expect(p.traderShareCents).toBe(1_600_00);
    expect(p.firmShareCents).toBe(400_00);
  });

  it("returns zero payout when there is no profit", () => {
    const p = calculatePayout(10_000_00, 9_500_00, 80);
    expect(p.profitCents).toBe(0);
    expect(p.traderShareCents).toBe(0);
    expect(p.firmShareCents).toBe(0);
  });

  it("rounds fractional cents deterministically and reconciles totals", () => {
    const p = calculatePayout(10_000_00, 10_000_33, 80);
    expect(p.traderShareCents + p.firmShareCents).toBe(p.profitCents);
  });
});

describe("applyCoupon", () => {
  it("applies a percent discount", () => {
    const r = applyCoupon(10000, { type: "PERCENT", value: 10, active: true });
    expect(r.discountCents).toBe(1000);
    expect(r.totalCents).toBe(9000);
    expect(r.couponValid).toBe(true);
  });

  it("applies a fixed discount, capped at the price", () => {
    const r = applyCoupon(500, { type: "FIXED", value: 1000, active: true });
    expect(r.discountCents).toBe(500);
    expect(r.totalCents).toBe(0);
  });

  it("rejects an expired coupon", () => {
    const r = applyCoupon(
      10000,
      { type: "PERCENT", value: 10, active: true, expiresAt: new Date("2020-01-01") },
      new Date("2026-01-01")
    );
    expect(r.couponValid).toBe(false);
    expect(r.totalCents).toBe(10000);
  });

  it("rejects a coupon that hit its redemption limit", () => {
    const r = applyCoupon(10000, {
      type: "PERCENT",
      value: 10,
      active: true,
      maxRedemptions: 5,
      timesRedeemed: 5,
    });
    expect(r.couponValid).toBe(false);
  });

  it("passes through unchanged with no coupon", () => {
    const r = applyCoupon(10000, null);
    expect(r.totalCents).toBe(10000);
    expect(r.couponValid).toBe(false);
  });
});

describe("phase transitions", () => {
  it("PHASE_1 -> PHASE_2 -> FUNDED -> terminal", () => {
    expect(nextPhase("PHASE_1")).toBe("PHASE_2");
    expect(nextPhase("PHASE_2")).toBe("FUNDED");
    expect(nextPhase("FUNDED")).toBeNull();
  });
});
