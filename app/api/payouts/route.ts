import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { calculatePayout } from "@/lib/risk-engine";
import { checkPayoutEligibility } from "@/lib/payout-eligibility";

export const dynamic = "force-dynamic";

// Trader-facing payout endpoints. GET lists payouts across the trader's own
// accounts; POST requests a new payout. All eligibility checks run
// server-side — the frontend only ever displays what this route computes
// and returns, per the platform rule that a trader can never determine
// their own payout eligibility or amount.

export async function GET() {
  const { session, error } = await requireUser();
  if (error || !session) return NextResponse.json({ error }, { status: 401 });

  const payouts = await prisma.payout.findMany({
    where: { account: { userId: session.user.id } },
    include: { account: { select: { id: true, template: { select: { accountSize: true } } } } },
    orderBy: { requestedAt: "desc" },
  });

  // Eligibility for each of the trader's own accounts, so the Payout center
  // can show exactly why a request is/isn't currently allowed without the
  // frontend recomputing any business rule itself.
  const accounts = await prisma.account.findMany({
    where: { userId: session.user.id },
    include: { template: true, phases: { orderBy: { createdAt: "desc" } }, payouts: true },
  });

  const eligibility = accounts.map((account) => {
    const currentPhase = account.phases[0];
    const hasOpenBreach = account.phases.some((p) => p.status === "FAILED");
    return {
      accountId: account.id,
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
          profitSplitTraderPct: Number(account.template.profitSplitTraderPct),
        },
        hasOpenBreach,
      }),
    };
  });

  return NextResponse.json({ payouts, eligibility });
}

const requestSchema = z.object({ accountId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error || !session) return NextResponse.json({ error }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "accountId is required." }, { status: 400 });

  const account = await prisma.account.findUnique({
    where: { id: parsed.data.accountId },
    include: { template: true, phases: { orderBy: { createdAt: "desc" } }, payouts: true },
  });

  if (!account || account.userId !== session.user.id) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const currentPhase = account.phases[0];
  const hasOpenBreach = account.phases.some((p) => p.status === "FAILED");

  const eligibility = checkPayoutEligibility({
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
      profitSplitTraderPct: Number(account.template.profitSplitTraderPct),
    },
    hasOpenBreach,
  });

  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reasons.join(" "), reasons: eligibility.reasons }, { status: 400 });
  }

  const calc = calculatePayout(account.startingBalanceCents, account.currentBalanceCents, Number(account.template.profitSplitTraderPct));

  const payout = await prisma.payout.create({
    data: {
      accountId: account.id,
      amountCents: calc.profitCents,
      traderShareCents: calc.traderShareCents,
      firmShareCents: calc.firmShareCents,
      status: "PENDING",
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: "PAYOUT_REQUESTED",
      targetType: "Payout",
      targetId: payout.id,
      metadata: { accountId: account.id, traderShareCents: calc.traderShareCents },
    },
  });

  await prisma.notification.create({
    data: {
      userId: session.user.id,
      type: "INFO",
      title: "Payout requested",
      body: `Your payout request for $${(calc.traderShareCents / 100).toLocaleString()} has been submitted and is under review.`,
    },
  });

  return NextResponse.json({ payout });
}
