import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Read-only diagnostic endpoint, at an unguessable path, gated by
// NEXTAUTH_SECRET. Every previous attempt at the ?secret= comparison
// returned "Unauthorized" no matter what was pasted in — the likely cause:
// URLSearchParams (used by req.nextUrl.searchParams) decodes "+" as a
// literal space per the application/x-www-form-urlencoded convention, so a
// secret containing "+" (common in a base64-ish NEXTAUTH_SECRET) silently
// never matched when pasted raw into a browser address bar. Parsing the
// query string manually here instead preserves "+" literally.
function getRawQueryParam(req: NextRequest, key: string): string | null {
  const query = req.nextUrl.search.replace(/^\?/, "");
  for (const pair of query.split("&")) {
    const [k, ...rest] = pair.split("=");
    if (decodeURIComponent(k) === key) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  // A dedicated, low-stakes debug token — deliberately NOT the real
  // NEXTAUTH_SECRET, since that's a live credential that shouldn't be
  // pasted into a URL. Set DEBUG_HEALTH_SECRET in Vercel to any string of
  // your choosing (letters/digits only, to sidestep query-string escaping
  // entirely) and redeploy.
  const secret = process.env.DEBUG_HEALTH_SECRET;
  const provided = getRawQueryParam(req, "secret")?.trim();
  if (!secret) {
    return NextResponse.json(
      { error: "Set a DEBUG_HEALTH_SECRET environment variable in Vercel and redeploy to use this endpoint." },
      { status: 500 }
    );
  }
  if (provided !== secret.trim()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  function scrub(message: string) {
    return message.replace(/postgres(?:ql)?:\/\/[^\s"']+/gi, "postgres://[redacted]");
  }

  async function check(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      checks[name] = { ok: true };
    } catch (err) {
      checks[name] = { ok: false, detail: scrub(err instanceof Error ? err.message : String(err)) };
    }
  }

  await check("db_connect", () => prisma.$queryRaw`SELECT 1`);
  await check("User_table", () => prisma.user.count());
  await check("User_resetToken_column", () => prisma.user.findFirst({ where: { resetToken: null } }));
  await check("ChallengeTemplate_table", () => prisma.challengeTemplate.count());
  await check("Order_table", () => prisma.order.count());
  await check("Order_agreedToRulesAt_column", () => prisma.order.findFirst({ where: { agreedToRulesAt: null } }));
  await check("Order_refundEligibleAt_column", () => prisma.order.findFirst({ where: { refundEligibleAt: null } }));
  await check("Order_platformId_column", () => prisma.order.findFirst({ where: { platformId: null } }));
  await check("Account_profitSplitPct_column", () => prisma.account.findFirst({ where: { profitSplitPct: null } }));
  await check("TradingPlatform_table", () => prisma.tradingPlatform.count());
  await check("PlatformAvailability_table", () => prisma.platformAvailability.count());
  await check("Addon_table", () => prisma.addon.count());
  await check("AddonAvailability_table", () => prisma.addonAvailability.count());
  await check("OrderAddon_table", () => prisma.orderAddon.count());
  await check("Coupon_table", () => prisma.coupon.count());
  await check("ChallengePhase_table", () => prisma.challengePhase.count());
  await check("Trade_table", () => prisma.trade.count());
  await check("Payout_table", () => prisma.payout.count());
  await check("RiskEvent_table", () => prisma.riskEvent.count());
  await check("Notification_table", () => prisma.notification.count());
  await check("AuditLog_table", () => prisma.auditLog.count());
  await check("Account_table_with_relations", () =>
    prisma.account.findMany({ take: 5, include: { template: true, phases: true, trades: true, order: true } })
  );

  const env = {
    DATABASE_URL_set: Boolean(process.env.DATABASE_URL),
    NEXTAUTH_SECRET_set: Boolean(process.env.NEXTAUTH_SECRET),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json({ allOk, env, checks }, { status: allOk ? 200 : 500 });
}
