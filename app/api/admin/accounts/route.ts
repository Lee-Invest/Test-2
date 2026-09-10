import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { accountAdminActionSchema } from "@/lib/validation";
import { markOrderRefundEligible } from "@/lib/refund";

export const dynamic = "force-dynamic";

// Admin-only account management. Traders can never PATCH their own balance,
// phase, or status directly — every mutation here is server-side, role
// checked, and logged to AuditLog.

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const accounts = await prisma.account.findMany({
    include: { user: { select: { email: true, name: true } }, template: true, phases: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  const { session, error } = await requireAdmin();
  if (error || !session) {
    if (isFormPost) return NextResponse.redirect(new URL("/login?next=/admin", req.url), 303);
    return NextResponse.json({ error }, { status: 403 });
  }

  const body = isFormPost ? Object.fromEntries((await req.formData()).entries()) : await req.json().catch(() => null);
  const parsed = accountAdminActionSchema.safeParse(body);
  if (!parsed.success) {
    if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=accounts&error=Invalid+action.", req.url), 303);
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { accountId, action, phase } = parsed.data;

  function fail(status: number, message: string) {
    if (isFormPost) {
      const url = new URL("/admin", req.url);
      url.searchParams.set("tab", "accounts");
      url.searchParams.set("error", message);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: message }, { status });
  }

  const account = await prisma.account.findUnique({ where: { id: accountId }, include: { phases: true } });
  if (!account) return fail(404, "Account not found");

  const currentPhase = account.phases.find((p) => p.status === "ACTIVE") ?? account.phases[0];

  switch (action) {
    case "SUSPEND":
      await prisma.account.update({ where: { id: accountId }, data: { isActive: false } });
      if (currentPhase) await prisma.challengePhase.update({ where: { id: currentPhase.id }, data: { status: "SUSPENDED" } });
      break;
    case "REACTIVATE":
      await prisma.account.update({ where: { id: accountId }, data: { isActive: true } });
      if (currentPhase) await prisma.challengePhase.update({ where: { id: currentPhase.id }, data: { status: "ACTIVE" } });
      break;
    case "RESET":
      await prisma.account.update({
        where: { id: accountId },
        data: {
          currentBalanceCents: account.startingBalanceCents,
          currentEquityCents: account.startingBalanceCents,
          highestBalanceCents: account.startingBalanceCents,
          dayStartEquityCents: account.startingBalanceCents,
          dayStartAt: new Date(),
          isActive: true,
        },
      });
      if (currentPhase) await prisma.challengePhase.update({ where: { id: currentPhase.id }, data: { status: "ACTIVE", tradingDays: 0 } });
      break;
    case "CLOSE":
      await prisma.account.update({ where: { id: accountId }, data: { isActive: false } });
      if (currentPhase) await prisma.challengePhase.update({ where: { id: currentPhase.id }, data: { status: "FAILED", endedAt: new Date() } });
      break;
    case "MARK_FUNDED":
      if (currentPhase) await prisma.challengePhase.update({ where: { id: currentPhase.id }, data: { status: "PASSED", endedAt: new Date() } });
      await prisma.challengePhase.create({
        data: {
          accountId,
          type: "FUNDED",
          status: "FUNDED",
          profitTargetPct: 0,
          maxDailyLossPct: currentPhase?.maxDailyLossPct ?? 5,
          maxOverallLossPct: currentPhase?.maxOverallLossPct ?? 10,
          minTradingDays: 0,
        },
      });
      await markOrderRefundEligible(accountId);
      break;
    case "SET_PHASE":
      if (!phase) return fail(400, "phase required for SET_PHASE");
      if (currentPhase) await prisma.challengePhase.update({ where: { id: currentPhase.id }, data: { status: "PASSED", endedAt: new Date() } });
      await prisma.challengePhase.create({
        data: {
          accountId,
          type: phase,
          status: phase === "FUNDED" ? "FUNDED" : "ACTIVE",
          profitTargetPct: currentPhase?.profitTargetPct ?? 0,
          maxDailyLossPct: currentPhase?.maxDailyLossPct ?? 5,
          maxOverallLossPct: currentPhase?.maxOverallLossPct ?? 10,
          minTradingDays: currentPhase?.minTradingDays ?? 0,
        },
      });
      if (phase === "FUNDED") await markOrderRefundEligible(accountId);
      break;
    case "MARK_REFUNDED": {
      const acct = await prisma.account.findUnique({ where: { id: accountId }, select: { orderId: true } });
      if (!acct?.orderId) return fail(400, "This account has no linked order.");
      const order = await prisma.order.findUnique({ where: { id: acct.orderId }, select: { refundEligibleAt: true } });
      if (!order?.refundEligibleAt) {
        return fail(400, "This order is not yet eligible for a refund.");
      }
      await prisma.order.update({ where: { id: acct.orderId }, data: { refundedAt: new Date() } });
      break;
    }
  }

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: `ACCOUNT_${action}`,
      targetType: "Account",
      targetId: accountId,
      metadata: { phase },
    },
  });

  if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=accounts", req.url), 303);
  return NextResponse.json({ ok: true });
}
