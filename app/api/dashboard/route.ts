import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { evaluateRisk, computeTradingStats, countTradingDays, calculatePayout } from "@/lib/risk-engine";

export const dynamic = "force-dynamic";

// Read-only aggregate view for the trader dashboard. All figures are
// computed server-side from stored Trade/Account rows via the risk engine —
// a trader has no write path to balance/phase/status here.
export async function GET() {
  const { session, error } = await requireUser();
  if (error || !session) return NextResponse.json({ error }, { status: 401 });

  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    include: {
      template: true,
      phases: { orderBy: { createdAt: "desc" } },
      trades: { orderBy: { openedAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  const results = accounts.map((account) => {
    const currentPhase = account.phases.find((p) => p.status === "ACTIVE") ?? account.phases[0];
    const closedTrades = account.trades.filter((t) => t.closedAt);
    const tradingDaysCompleted = countTradingDays(
      closedTrades.map((t) => t.closedAt as Date),
      account.template.dailyResetTimeUtc
    );

    const risk = currentPhase
      ? evaluateRisk(
          {
            startingBalanceCents: account.startingBalanceCents,
            currentBalanceCents: account.currentBalanceCents,
            currentEquityCents: account.currentEquityCents,
            highestBalanceCents: account.highestBalanceCents,
            dayStartBalanceCents: account.dayStartEquityCents,
            tradingDaysCompleted,
          },
          {
            maxDailyLossPct: Number(currentPhase.maxDailyLossPct),
            maxOverallLossPct: Number(currentPhase.maxOverallLossPct),
            profitTargetPct: Number(currentPhase.profitTargetPct),
            minTradingDays: currentPhase.minTradingDays,
          }
        )
      : null;

    const stats = computeTradingStats(account.trades.map((t) => ({ pnlCents: t.pnlCents })));

    const isFunded = currentPhase?.type === "FUNDED" && currentPhase.status === "FUNDED";
    const payoutCalc = calculatePayout(
      account.startingBalanceCents,
      account.currentBalanceCents,
      Number(account.template.profitSplitTraderPct)
    );

    return {
      id: account.id,
      accountSize: account.template.accountSize,
      startingBalanceCents: account.startingBalanceCents,
      currentBalanceCents: account.currentBalanceCents,
      currentEquityCents: account.currentEquityCents,
      isActive: account.isActive,
      currentPhase: currentPhase
        ? { type: currentPhase.type, status: currentPhase.status, tradingDays: tradingDaysCompleted }
        : null,
      risk,
      stats,
      trades: account.trades.slice(0, 100),
      isFunded,
      profitSplitTraderPct: Number(account.template.profitSplitTraderPct),
      availablePayoutCents: isFunded ? payoutCalc.traderShareCents : 0,
    };
  });

  return NextResponse.json({ accounts: results });
}
