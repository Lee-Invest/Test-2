import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { payoutActionSchema } from "@/lib/validation";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const payouts = await prisma.payout.findMany({
    include: { account: { include: { user: { select: { email: true, name: true } } } } },
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

  const { payoutId, action, notes } = parsed.data;
  const statusMap = { APPROVE: "APPROVED", REJECT: "REJECTED", MARK_PAID: "PAID" } as const;

  const payout = await prisma.payout.update({
    where: { id: payoutId },
    data: { status: statusMap[action], notes, processedAt: new Date() },
  });

  await prisma.auditLog.create({
    data: { actorId: session.user.id, action: `PAYOUT_${action}`, targetType: "Payout", targetId: payoutId },
  });

  return NextResponse.json({ payout });
}
