import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Read-only diagnostic endpoint: checks that every table/column this app
// depends on actually exists and is queryable in the live database, so a
// missing migration shows up as a clear named error instead of a silent
// "nothing happens" on register/login/checkout. Gated by a shared secret
// (DEBUG_HEALTH_SECRET) so it can't be scraped by randoms; falls back to
// requiring the NEXTAUTH_SECRET if the dedicated one isn't set.
export async function GET(req: NextRequest) {
  const secret = process.env.DEBUG_HEALTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const provided = req.nextUrl.searchParams.get("secret");
  if (!secret) {
    return NextResponse.json(
      { error: "NEXTAUTH_SECRET is not set in this environment — that alone would break login." },
      { status: 500 }
    );
  }
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  async function check(name: string, fn: () => Promise<unknown>) {
    try {
      await fn();
      checks[name] = { ok: true };
    } catch (err) {
      checks[name] = { ok: false, detail: err instanceof Error ? err.message : String(err) };
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

  const env = {
    DATABASE_URL_set: Boolean(process.env.DATABASE_URL),
    NEXTAUTH_SECRET_set: Boolean(process.env.NEXTAUTH_SECRET),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return NextResponse.json({ allOk, env, checks }, { status: allOk ? 200 : 500 });
}
