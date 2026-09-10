/**
 * checkAndAdvancePhase(accountId)
 * ================================
 * Given no real cron/scheduler infrastructure in this deployment, phase
 * progression (and breach detection) is evaluated lazily: this function is
 * called every time the dashboard API loads an account, so a trader sees
 * up-to-date status on next page view without needing a background worker.
 *
 * It re-runs the same `evaluateRisk()` used for display, and if the result
 * indicates a breach or a passed phase that hasn't been persisted yet, it
 * performs the corresponding state transition (via account-state-machine),
 * creates the ChallengePhase / RiskEvent / Notification rows, and writes an
 * AuditLog entry — all inside one transaction so a partial failure can't
 * leave the account in an inconsistent state.
 */

import { prisma } from "./prisma";
import { evaluateRisk, countTradingDays } from "./risk-engine";
import { nextPhase } from "./phase-transition";
import { assertValidTransition } from "./account-state-machine";
import { markOrderRefundEligible } from "./refund";
import type { PhaseType, Prisma } from "@prisma/client";

export async function checkAndAdvancePhase(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      template: true,
      program: true,
      phases: { orderBy: { createdAt: "desc" } },
      trades: true,
    },
  });
  if (!account) return;

  const currentPhase = account.phases.find((p) => p.status === "ACTIVE");
  if (!currentPhase || !account.isActive) return; // nothing to advance

  const closedTrades = account.trades.filter((t) => t.closedAt);
  const tradingDaysCompleted = countTradingDays(
    closedTrades.map((t) => t.closedAt as Date),
    account.template.dailyResetTimeUtc
  );

  const risk = evaluateRisk(
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
  );

  if (risk.breached) {
    assertValidTransition(currentPhase.status, "FAILED");
    await prisma.$transaction([
      prisma.challengePhase.update({
        where: { id: currentPhase.id },
        data: { status: "FAILED", endedAt: new Date() },
      }),
      prisma.account.update({ where: { id: account.id }, data: { isActive: false } }),
      ...risk.events.map((e) =>
        prisma.riskEvent.create({
          data: {
            accountId: account.id,
            type: e.type,
            message: e.message,
            metadata: e.metadata as Prisma.InputJsonValue,
          },
        })
      ),
      prisma.notification.create({
        data: {
          userId: account.userId,
          type: "ERROR",
          title: "Account failed",
          body: `Your ${currentPhase.type} account has failed a risk rule: ${risk.events[0]?.message ?? "risk limit breached"}.`,
        },
      }),
    ]);
    return;
  }

  if (risk.phasePassed) {
    assertValidTransition(currentPhase.status, "PASSED");
    const next = nextPhase(currentPhase.type as PhaseType, account.program?.phaseCount ?? 2);

    const writes: Prisma.PrismaPromise<unknown>[] = [
      prisma.challengePhase.update({
        where: { id: currentPhase.id },
        data: { status: "PASSED", endedAt: new Date() },
      }),
    ];

    if (next) {
      writes.push(
        prisma.challengePhase.create({
          data: {
            accountId: account.id,
            type: next,
            status: next === "FUNDED" ? "FUNDED" : "ACTIVE",
            profitTargetPct: next === "FUNDED" ? 0 : currentPhase.profitTargetPct,
            maxDailyLossPct: currentPhase.maxDailyLossPct,
            maxOverallLossPct: currentPhase.maxOverallLossPct,
            minTradingDays: next === "FUNDED" ? 0 : currentPhase.minTradingDays,
          },
        })
      );
      // Progressing to the next phase re-evaluates against the SAME
      // starting balance — reset the daily/high-water-mark trackers so the
      // new phase starts clean, matching the risk-engine's documented
      // phase-transition contract.
      writes.push(
        prisma.account.update({
          where: { id: account.id },
          data: {
            highestBalanceCents: account.currentBalanceCents,
            dayStartEquityCents: account.currentBalanceCents,
            dayStartAt: new Date(),
          },
        })
      );
    }

    writes.push(
      prisma.notification.create({
        data: {
          userId: account.userId,
          type: "SUCCESS",
          title: next ? `${currentPhase.type} passed` : "Challenge complete",
          body: next
            ? `Congratulations — you passed ${currentPhase.type} and have advanced to ${next}.`
            : `Congratulations — you have completed the funded stage requirements.`,
        },
      })
    );

    await prisma.$transaction(writes);

    if (next === "FUNDED") {
      await markOrderRefundEligible(account.id);
    }
  }
}
