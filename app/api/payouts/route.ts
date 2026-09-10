import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { calculatePayout } from "@/lib/risk-engine";
import { checkPayoutEligibility } from "@/lib/payout-eligibility";
import { effectiveProfitSplitPct } from "@/lib/profit-split";
import { getPayoutsView } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

// Trader-facing payout endpoints. GET lists payouts across the trader's own
// accounts; POST requests a new payout. All eligibility checks run
// server-side — the frontend only ever displays what this route computes
// and returns, per the platform rule that a trader can never determine
// their own payout eligibility or amount.

export async function GET() {
  const { session, error } = await requireUser();
  if (error || !session) return NextResponse.json({ error }, { status: 401 });

  const { payouts, eligibility } = await getPayoutsView(session.user.id);
  return NextResponse.json({ payouts, eligibility });
}

const requestSchema = z.object({ accountId: z.string().min(1) });

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error || !session) return NextResponse.json({ error }, { status: 401 });

  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  let raw: unknown;
  if (isFormPost) {
    const form = await req.formData();
    raw = { accountId: form.get("accountId") };
  } else {
    raw = await req.json().catch(() => null);
  }

  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    if (isFormPost) {
      return NextResponse.redirect(new URL("/dashboard/payouts?error=accountId+is+required.", req.url), 303);
    }
    return NextResponse.json({ error: "accountId is required." }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { id: parsed.data.accountId },
    include: { template: true, phases: { orderBy: { createdAt: "desc" } }, payouts: true },
  });

  if (!account || account.userId !== session.user.id) {
    if (isFormPost) {
      return NextResponse.redirect(new URL("/dashboard/payouts?error=Account+not+found.", req.url), 303);
    }
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  const currentPhase = account.phases[0];
  const hasOpenBreach = account.phases.some((p) => p.status === "FAILED");

  const profitSplitTraderPct = effectiveProfitSplitPct(
    account.profitSplitPct ? Number(account.profitSplitPct) : null,
    Number(account.template.profitSplitTraderPct)
  );

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
      profitSplitTraderPct,
    },
    hasOpenBreach,
  });

  if (!eligibility.eligible) {
    const message = eligibility.reasons.join(" ");
    if (isFormPost) {
      const url = new URL("/dashboard/payouts", req.url);
      url.searchParams.set("error", message);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: message, reasons: eligibility.reasons }, { status: 400 });
  }

  const calc = calculatePayout(account.startingBalanceCents, account.currentBalanceCents, profitSplitTraderPct);

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

  if (isFormPost) {
    return NextResponse.redirect(new URL("/dashboard/payouts?requested=1", req.url), 303);
  }

  return NextResponse.json({ payout });
}
