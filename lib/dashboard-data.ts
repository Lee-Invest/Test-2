import { prisma } from "./prisma";
import { evaluateRisk, computeTradingStats, countTradingDays, calculatePayout } from "./risk-engine";
import { checkAndAdvancePhase } from "./phase-advance";
import { effectiveProfitSplitPct } from "./profit-split";
import { checkPayoutEligibility } from "./payout-eligibility";

// Shared by the server-rendered /dashboard page and the /api/dashboard
// client-refresh endpoint, so both read the exact same computed shape.
export async function getDashboardAccounts(userId: string) {
  const ids = await prisma.account.findMany({ where: { userId }, select: { id: true } });
  for (const { id } of ids) {
    await checkAndAdvancePhase(id);
  }

  const accounts = await prisma.account.findMany({
    where: { userId },
    include: {
      template: true,
      platform: true,
      phases: { orderBy: { createdAt: "desc" } },
      trades: { orderBy: { openedAt: "desc" } },
      order: { select: { totalCents: true, refundEligibleAt: true, refundedAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const latestRiskEvents = await prisma.riskEvent.findMany({
    where: { accountId: { in: accounts.map((a) => a.id) } },
    orderBy: { createdAt: "desc" },
  });

  return accounts.map((account) => {
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
    const isFailed = currentPhase?.status === "FAILED";
    const isFunded = currentPhase?.type === "FUNDED" && currentPhase.status === "FUNDED";
    const profitSplitPct = effectiveProfitSplitPct(
      account.profitSplitPct ? Number(account.profitSplitPct) : null,
      Number(account.template.profitSplitTraderPct)
    );
    const payoutCalc = calculatePayout(account.startingBalanceCents, account.currentBalanceCents, profitSplitPct);

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
      trades: account.trades.slice(0, 100).map((t) => ({
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        pnlCents: t.pnlCents,
        openedAt: t.openedAt,
        closedAt: t.closedAt,
      })),
      isFunded,
      profitSplitTraderPct: profitSplitPct,
      availablePayoutCents: isFunded ? payoutCalc.traderShareCents : 0,
      isFailed,
      breachEvent: isFailed ? latestRiskEvents.find((e) => e.accountId === account.id) ?? null : null,
      refund: account.order
        ? {
            eligible: Boolean(account.order.refundEligibleAt),
            refunded: Boolean(account.order.refundedAt),
            amountCents: account.order.totalCents,
          }
        : null,
      platform: account.platform
        ? {
            name: account.platform.name,
            accessUrl: account.platform.accessUrl,
            downloadUrl: account.platform.downloadUrl,
            webUrl: account.platform.webUrl,
            setupSteps: account.platform.setupSteps,
          }
        : null,
      credentials:
        account.platformLogin && account.platformServerName
          ? {
              login: account.platformLogin,
              server: account.platformServerName,
              password: account.platformPasswordDisplay,
            }
          : null,
    };
  });
}

// "My saved challenges" on the dashboard.
export async function getSavedConfigurations(userId: string) {
  return prisma.savedConfiguration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

export type DashboardAccount = Awaited<ReturnType<typeof getDashboardAccounts>>[number];

// Shared by the server-rendered /dashboard/payouts page and the
// /api/payouts client-refresh endpoint.
export async function getPayoutsView(userId: string) {
  const payouts = await prisma.payout.findMany({
    where: { account: { userId } },
    include: { account: { select: { id: true, template: { select: { accountSize: true } } } } },
    orderBy: { requestedAt: "desc" },
  });

  const accounts = await prisma.account.findMany({
    where: { userId },
    include: { template: true, phases: { orderBy: { createdAt: "desc" } }, payouts: true },
  });

  const eligibility = accounts.map((account) => {
    const currentPhase = account.phases[0];
    const hasOpenBreach = account.phases.some((p) => p.status === "FAILED");
    return {
      accountId: account.id,
      accountSize: account.template.accountSize,
      ...checkPayoutEligibility({
        account,
        currentPhase: currentPhase
          ? {
              type: currentPhase.type,
              status: currentPhase.status,
              tradingDays: currentPhase.tradingDays,
              minTradingDays: currentPhase.minTradingDays,
            }
          : undefined,
        payouts: account.payouts,
        template: {
          minPayoutCents: account.template.minPayoutCents,
          payoutCycleDays: account.template.payoutCycleDays,
          profitSplitTraderPct: effectiveProfitSplitPct(
            account.profitSplitPct ? Number(account.profitSplitPct) : null,
            Number(account.template.profitSplitTraderPct)
          ),
        },
        hasOpenBreach,
      }),
    };
  });

  return { payouts, eligibility };
}
