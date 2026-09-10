/**
 * Funded profit-split scaling plan.
 *
 * Every account starts at the challenge template's default split (80%).
 * Each time a payout is marked PAID (see app/api/admin/payouts/route.ts),
 * the account's own split increases by SCALE_INCREMENT_PCT, capped at
 * MAX_PROFIT_SPLIT_PCT — rewarding traders who stay funded and keep
 * withdrawing profit, without ever exceeding the advertised maximum.
 */
export const SCALE_INCREMENT_PCT = 5;
export const MAX_PROFIT_SPLIT_PCT = 95;

export function nextProfitSplitPct(currentPct: number): number {
  return Math.min(MAX_PROFIT_SPLIT_PCT, currentPct + SCALE_INCREMENT_PCT);
}

export function effectiveProfitSplitPct(accountOverridePct: number | null, templateDefaultPct: number): number {
  return accountOverridePct ?? templateDefaultPct;
}
