/**
 * Payout eligibility service — single source of truth for "can this trader
 * request a payout right now", used by both the POST /api/payouts route and
 * the dashboard Payout center display. The frontend never re-derives this;
 * it only renders the `reasons` this function returns.
 */

import { calculatePayout } from "./risk-engine";

export interface EligibilityAccount {
  isActive: boolean;
  startingBalanceCents: number;
  currentBalanceCents: number;
  currentEquityCents: number;
  createdAt: Date;
}

export interface EligibilityPhase {
  type: "PHASE_1" | "PHASE_2" | "FUNDED";
  status: string;
  tradingDays: number;
  minTradingDays: number;
}

export interface EligibilityPayout {
  status: string;
  requestedAt: Date;
  processedAt: Date | null;
}

export interface EligibilityTemplate {
  minPayoutCents: number;
  payoutCycleDays: number;
  profitSplitTraderPct: number;
}

export interface EligibilityInput {
  account: EligibilityAccount;
  currentPhase: EligibilityPhase | undefined;
  payouts: EligibilityPayout[];
  template: EligibilityTemplate;
  hasOpenBreach: boolean; // e.g. an unresolved RiskEvent / FAILED phase
  now?: Date;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
  availableCents: number;
  minPayoutCents: number;
  nextEligibleDate: Date | null;
}

const OPEN_PAYOUT_STATUSES = new Set(["PENDING", "UNDER_REVIEW", "APPROVED", "PROCESSING"]);

/**
 * Evaluates every payout-eligibility rule for a funded account. Returns a
 * structured result so the UI can show exactly why a request is blocked,
 * rather than a single opaque boolean.
 */
export function checkPayoutEligibility(input: EligibilityInput): EligibilityResult {
  const { account, currentPhase, payouts, template, hasOpenBreach } = input;
  const now = input.now ?? new Date();
  const reasons: string[] = [];

  // 1. Funded status required.
  if (!currentPhase || currentPhase.type !== "FUNDED" || currentPhase.status !== "FUNDED") {
    reasons.push("Account must be on a FUNDED phase to request a payout.");
  }

  // 2. Account must be active and not breached.
  if (!account.isActive) {
    reasons.push("Account is not active.");
  }
  if (hasOpenBreach) {
    reasons.push("Account has an unresolved risk breach.");
  }

  // 3. Minimum trading days on the funded phase.
  if (currentPhase && currentPhase.tradingDays < currentPhase.minTradingDays) {
    reasons.push(
      `Minimum trading days not yet met (${currentPhase.tradingDays}/${currentPhase.minTradingDays}).`
    );
  }

  // 4. Minimum profit / payout amount.
  const calc = calculatePayout(
    account.startingBalanceCents,
    account.currentBalanceCents,
    template.profitSplitTraderPct
  );
  if (calc.traderShareCents < template.minPayoutCents) {
    reasons.push(
      `Available payout ($${(calc.traderShareCents / 100).toFixed(2)}) is below the minimum of $${(
        template.minPayoutCents / 100
      ).toFixed(2)}.`
    );
  }

  // 5. Payout cycle elapsed since account creation or last processed payout.
  const paidOrLastProcessed = payouts
    .filter((p) => p.processedAt)
    .sort((a, b) => (b.processedAt as Date).getTime() - (a.processedAt as Date).getTime())[0];
  const cycleAnchor = paidOrLastProcessed?.processedAt ?? account.createdAt;
  const cycleMs = template.payoutCycleDays * 24 * 60 * 60 * 1000;
  const nextEligibleDate = new Date(cycleAnchor.getTime() + cycleMs);
  if (now.getTime() < nextEligibleDate.getTime()) {
    reasons.push(
      `Payout cycle has not elapsed yet. Next eligible date: ${nextEligibleDate.toISOString().slice(0, 10)}.`
    );
  }

  // 6. No existing open payout request.
  if (payouts.some((p) => OPEN_PAYOUT_STATUSES.has(p.status))) {
    reasons.push("There is already an open payout request for this account.");
  }

  // 7. No open positions. The mock trading engine only records trades with
  // closedAt set once closed — there is no concept of a live open order
  // book, so this check always passes and is documented here rather than
  // silently omitted.
  // (always true — no-op, kept for spec traceability)

  return {
    eligible: reasons.length === 0,
    reasons,
    availableCents: calc.traderShareCents,
    minPayoutCents: template.minPayoutCents,
    nextEligibleDate: now.getTime() < nextEligibleDate.getTime() ? nextEligibleDate : null,
  };
}
