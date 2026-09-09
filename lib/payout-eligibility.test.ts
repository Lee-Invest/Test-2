import { describe, it, expect } from "vitest";
import { checkPayoutEligibility, type EligibilityInput } from "./payout-eligibility";

const baseInput = (overrides: Partial<EligibilityInput> = {}): EligibilityInput => ({
  account: {
    isActive: true,
    startingBalanceCents: 10_000_00,
    currentBalanceCents: 11_000_00, // $1,000 profit
    currentEquityCents: 11_000_00,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  },
  currentPhase: { type: "FUNDED", status: "FUNDED", tradingDays: 10, minTradingDays: 4 },
  payouts: [],
  template: { minPayoutCents: 3000, payoutCycleDays: 14, profitSplitTraderPct: 80 },
  hasOpenBreach: false,
  now: new Date("2026-02-01T00:00:00Z"), // well past the 14-day cycle
  ...overrides,
});

describe("payout-eligibility", () => {
  it("is eligible when every rule passes", () => {
    const result = checkPayoutEligibility(baseInput());
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
    expect(result.availableCents).toBe(800_00); // 80% of $1,000
  });

  it("blocks non-funded accounts", () => {
    const result = checkPayoutEligibility(
      baseInput({ currentPhase: { type: "PHASE_1", status: "ACTIVE", tradingDays: 10, minTradingDays: 4 } })
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes("FUNDED"))).toBe(true);
  });

  it("blocks when below minimum payout amount", () => {
    const result = checkPayoutEligibility(
      baseInput({
        account: {
          isActive: true,
          startingBalanceCents: 10_000_00,
          currentBalanceCents: 10_010_00, // tiny profit
          currentEquityCents: 10_010_00,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      })
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes("minimum"))).toBe(true);
  });

  it("blocks before the payout cycle has elapsed", () => {
    const result = checkPayoutEligibility(baseInput({ now: new Date("2026-01-05T00:00:00Z") }));
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes("cycle"))).toBe(true);
    expect(result.nextEligibleDate).not.toBeNull();
  });

  it("blocks when an open payout request already exists", () => {
    const result = checkPayoutEligibility(
      baseInput({ payouts: [{ status: "PENDING", requestedAt: new Date(), processedAt: null }] })
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes("already an open"))).toBe(true);
  });

  it("blocks accounts with an open breach", () => {
    const result = checkPayoutEligibility(baseInput({ hasOpenBreach: true }));
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes("breach"))).toBe(true);
  });

  it("blocks when minimum trading days on the funded phase are unmet", () => {
    const result = checkPayoutEligibility(
      baseInput({ currentPhase: { type: "FUNDED", status: "FUNDED", tradingDays: 1, minTradingDays: 4 } })
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes("trading days"))).toBe(true);
  });

  it("uses the last processed payout as the cycle anchor, not account creation", () => {
    const result = checkPayoutEligibility(
      baseInput({
        payouts: [
          { status: "PAID", requestedAt: new Date("2026-01-20T00:00:00Z"), processedAt: new Date("2026-01-25T00:00:00Z") },
        ],
        now: new Date("2026-01-30T00:00:00Z"), // only 5 days after last payout
      })
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes("cycle"))).toBe(true);
  });
});
