import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public endpoint surfacing the site-wide promotional coupon (if any), so
// the homepage can show a real, currently-valid discount rather than a
// fabricated one. Only returns template-agnostic, unexpired, active,
// not-yet-exhausted coupons — the same rules the checkout API itself
// enforces when the code is actually redeemed.
export async function GET() {
  const now = new Date();

  const coupon = await prisma.coupon.findFirst({
    where: {
      active: true,
      templateId: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!coupon || (coupon.maxRedemptions !== null && coupon.timesRedeemed >= coupon.maxRedemptions)) {
    return NextResponse.json({ promo: null });
  }

  return NextResponse.json({
    promo: { code: coupon.code, type: coupon.type, value: Number(coupon.value) },
  });
}
