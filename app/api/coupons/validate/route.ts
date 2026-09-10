import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { applyCoupon } from "@/lib/risk-engine";

export const dynamic = "force-dynamic";

// Live coupon preview so the order summary can show the discount before
// checkout — read-only, doesn't redeem anything. /api/checkout re-runs this
// same applyCoupon() logic authoritatively at purchase time, so this can
// never be used to manipulate the final price.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const templateId = req.nextUrl.searchParams.get("templateId");
  if (!code || !templateId) {
    return NextResponse.json({ error: "code and templateId are required." }, { status: 400 });
  }

  const template = await prisma.challengeTemplate.findUnique({ where: { id: templateId } });
  if (!template) return NextResponse.json({ error: "Challenge template not found." }, { status: 404 });

  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon || (coupon.templateId && coupon.templateId !== template.id)) {
    return NextResponse.json({ valid: false, reason: "Coupon not found for this account size." });
  }

  const calc = applyCoupon(template.priceCents, {
    type: coupon.type,
    value: Number(coupon.value),
    active: coupon.active,
    expiresAt: coupon.expiresAt,
    maxRedemptions: coupon.maxRedemptions,
    timesRedeemed: coupon.timesRedeemed,
  });

  return NextResponse.json({
    valid: calc.couponValid,
    reason: calc.couponValid ? undefined : calc.reason ?? "Coupon not valid.",
    subtotalCents: calc.subtotalCents,
    discountCents: calc.discountCents,
    totalCents: calc.totalCents,
  });
}
