import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { payoutActionSchema } from "@/lib/validation";
import { effectiveProfitSplitPct, nextProfitSplitPct } from "@/lib/profit-split";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  // Full review context: trader, account, prior payouts, and risk events,
  // so admin can review a request without hopping between screens.
  const payouts = await prisma.payout.findMany({
    include: {
      account: {
        include: {
          user: { select: { id: true, email: true, name: true } },
          template: true,
          payouts: { orderBy: { requestedAt: "desc" } },
          riskEvents: { orderBy: { createdAt: "desc" }, take: 20 },
        },
      },
    },
    orderBy: { requestedAt: "desc" },
  });
  return NextResponse.json({ payouts });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error || !session) return NextResponse.json({ error }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = payoutActionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { payoutId, action, notes, rejectionReason } = parsed.data;
  const statusMap = {
    APPROVE: "APPROVED",
    REJECT: "REJECTED",
    MARK_PAID: "PAID",
    UNDER_REVIEW: "UNDER_REVIEW",
    PROCESSING: "PROCESSING",
    CANCEL: "CANCELLED",
  } as const;

  const existing = await prisma.payout.findUnique({
    where: { id: payoutId },
    include: { account: { include: { template: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Payout not found." }, { status: 404 });

  const isTerminal = action === "REJECT" || action === "MARK_PAID" || action === "CANCEL";

  // Scaling plan: each PAID payout bumps the account's own profit split
  // (starting from the template default) by SCALE_INCREMENT_PCT, capped at
  // MAX_PROFIT_SPLIT_PCT. See lib/profit-split.ts.
  let newSplitPct: number | null = null;
  if (action === "MARK_PAID") {
    const currentPct = effectiveProfitSplitPct(
      existing.account.profitSplitPct ? Number(existing.account.profitSplitPct) : null,
      Number(existing.account.template.profitSplitTraderPct)
    );
    newSplitPct = nextProfitSplitPct(currentPct);
  }

  const [payout] = await prisma.$transaction([
    prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: statusMap[action],
        notes,
        rejectionReason: action === "REJECT" ? rejectionReason : existing.rejectionReason,
        processedAt: isTerminal ? new Date() : existing.processedAt,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: `PAYOUT_${action}`,
        targetType: "Payout",
        targetId: payoutId,
        metadata: { rejectionReason, notes },
      },
    }),
    prisma.notification.create({
      data: {
        userId: existing.account.userId,
        type: action === "REJECT" ? "WARNING" : action === "MARK_PAID" ? "SUCCESS" : "INFO",
        title: `Payout ${statusMap[action].toLowerCase().replace("_", " ")}`,
        body:
          action === "REJECT"
            ? `Your payout request was rejected: ${rejectionReason}`
            : action === "MARK_PAID"
            ? `Your payout of $${(existing.traderShareCents / 100).toFixed(2)} has been paid.${
                newSplitPct ? ` Your profit split is now ${newSplitPct}%.` : ""
              }`
            : `Your payout request status changed to ${statusMap[action]}.`,
      },
    }),
    ...(newSplitPct
      ? [prisma.account.update({ where: { id: existing.account.id }, data: { profitSplitPct: newSplitPct } })]
      : []),
  ]);

  return NextResponse.json({ payout, newProfitSplitPct: newSplitPct });
}
