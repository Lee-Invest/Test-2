import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validation";
import { applyCoupon } from "@/lib/risk-engine";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in to purchase a challenge." }, { status: 401 });
  }

  const rl = rateLimit(`checkout:${session.user.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { templateId, couponCode } = parsed.data;

  const template = await prisma.challengeTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.active) {
    return NextResponse.json({ error: "Challenge template not found." }, { status: 404 });
  }

  let coupon = null;
  if (couponCode) {
    coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    if (coupon && coupon.templateId && coupon.templateId !== template.id) {
      coupon = null;
    }
  }

  const priceCalc = applyCoupon(
    template.priceCents,
    coupon
      ? {
          type: coupon.type,
          value: Number(coupon.value),
          active: coupon.active,
          expiresAt: coupon.expiresAt,
          maxRedemptions: coupon.maxRedemptions,
          timesRedeemed: coupon.timesRedeemed,
        }
      : null
  );

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      templateId: template.id,
      couponId: priceCalc.couponValid ? coupon?.id : undefined,
      subtotalCents: priceCalc.subtotalCents,
      discountCents: priceCalc.discountCents,
      totalCents: priceCalc.totalCents,
      status: "PENDING",
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: session.user.email ?? undefined,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `${template.name} — $${template.accountSize.toLocaleString()} Challenge` },
            unit_amount: priceCalc.totalCents,
          },
          quantity: 1,
        },
      ],
      metadata: { orderId: order.id },
      success_url: `${baseUrl}/checkout/success?orderId=${order.id}`,
      cancel_url: `${baseUrl}/pricing`,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    return NextResponse.json({ url: checkoutSession.url, orderId: order.id });
  } catch (err) {
    // In local/dev environments without real Stripe keys, this call fails.
    // We still return the created order so the flow can be exercised.
    return NextResponse.json(
      { error: "Stripe checkout session could not be created (dev mode?).", orderId: order.id, detail: (err as Error).message },
      { status: 502 }
    );
  }
}
