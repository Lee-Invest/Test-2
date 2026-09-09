import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { calculatePayout } from "@/lib/risk-engine";

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

  return NextResponse.json({ payouts });
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

  if (!account.isActive) {
    return NextResponse.json({ error: "This account is not active." }, { status: 400 });
  }

  const currentPhase = account.phases[0];
  if (!currentPhase || currentPhase.type !== "FUNDED" || currentPhase.status !== "FUNDED") {
    return NextResponse.json({ error: "Only funded accounts are eligible for a payout." }, { status: 400 });
  }

  const hasOpenRequest = account.payouts.some((p) => p.status === "PENDING" || p.status === "APPROVED");
  if (hasOpenRequest) {
    return NextResponse.json({ error: "There is already an open payout request for this account." }, { status: 400 });
  }

  const calc = calculatePayout(account.startingBalanceCents, account.currentBalanceCents, Number(account.template.profitSplitTraderPct));

  if (calc.traderShareCents <= 0) {
    return NextResponse.json({ error: "No payable profit is available on this account yet." }, { status: 400 });
  }

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
