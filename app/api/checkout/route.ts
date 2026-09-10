import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validation";
import { applyCoupon } from "@/lib/risk-engine";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

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

  const { templateId, couponCode, platformId, addonIds } = parsed.data;
  const agreedAt = new Date();

  const template = await prisma.challengeTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.active) {
    return NextResponse.json({ error: "Challenge template not found." }, { status: 404 });
  }

  // Platform is optional, but if one was picked, the (template, platform)
  // combination must actually be allowed by the availability engine — never
  // trust the frontend's own idea of what's available.
  let platformFeeCents = 0;
  if (platformId) {
    const platform = await prisma.tradingPlatform.findUnique({ where: { id: platformId } });
    if (!platform || !platform.active) {
      return NextResponse.json({ error: "Selected trading platform not found." }, { status: 404 });
    }
    const availability = await prisma.platformAvailability.findUnique({
      where: { templateId_platformId: { templateId: template.id, platformId } },
    });
    if (availability && !availability.allowed) {
      return NextResponse.json(
        { error: availability.unavailableReason ?? "This platform isn't available for the selected account size." },
        { status: 400 }
      );
    }
    platformFeeCents = availability?.feeCents ?? 0;
  }

  // Add-ons are optional, but each one must actually be active and allowed
  // for this template — never trust the frontend's list of what's on offer.
  let addons: { id: string; priceCents: number }[] = [];
  if (addonIds && addonIds.length > 0) {
    const found = await prisma.addon.findMany({ where: { id: { in: addonIds }, active: true } });
    if (found.length !== addonIds.length) {
      return NextResponse.json({ error: "One or more selected add-ons are no longer available." }, { status: 400 });
    }
    const availabilityRows = await prisma.addonAvailability.findMany({
      where: { templateId: template.id, addonId: { in: addonIds } },
    });
    const blocked = availabilityRows.find((a) => !a.allowed);
    if (blocked) {
      return NextResponse.json({ error: "One or more selected add-ons aren't available for this account size." }, { status: 400 });
    }
    addons = found.map((a) => ({ id: a.id, priceCents: a.priceCents }));
  }
  const addonTotalCents = addons.reduce((sum, a) => sum + a.priceCents, 0);

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
      platformId: platformId ?? undefined,
      subtotalCents: priceCalc.subtotalCents,
      discountCents: priceCalc.discountCents,
      platformFeeCents,
      totalCents: priceCalc.totalCents + platformFeeCents + addonTotalCents,
      status: "PENDING",
      agreedToRulesAt: agreedAt,
      addons: {
        create: addons.map((a) => ({ addonId: a.id, priceCentsAtOrder: a.priceCents })),
      },
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

  // No real Stripe account configured: send the buyer to a simulated
  // payment page (looks and feels like a card checkout) instead of a real
  // Stripe Checkout Session, so the full "buy a challenge -> pay -> get an
  // account -> see the dashboard" flow can be exercised end to end without
  // a Stripe account. No card data is collected or transmitted anywhere.
  if (!isStripeConfigured) {
    return NextResponse.json({
      url: `${baseUrl}/checkout/pay?orderId=${order.id}`,
      orderId: order.id,
      devMode: true,
    });
  }

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
            unit_amount: order.totalCents,
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
