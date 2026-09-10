import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { checkoutSchema } from "@/lib/validation";
import { applyCoupon } from "@/lib/risk-engine";
import { rateLimit } from "@/lib/rate-limit";
import { getMultiAccountDiscountPct } from "@/lib/multi-account-discount";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    if (isFormPost) {
      return NextResponse.redirect(new URL("/login?next=/pricing", req.url), 303);
    }
    return NextResponse.json({ error: "You must be signed in to purchase a challenge." }, { status: 401 });
  }

  const rl = rateLimit(`checkout:${session.user.id}`, 10, 60_000);
  if (!rl.allowed) {
    if (isFormPost) {
      return NextResponse.redirect(new URL("/pricing?error=Too+many+requests.", req.url), 303);
    }
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  if (isFormPost) {
    const form = await req.formData();
    body = {
      templateId: form.get("templateId") || undefined,
      programId: form.get("programId") || undefined,
      couponCode: form.get("couponCode") || undefined,
      platformId: form.get("platformId") || undefined,
      addonIds: form.getAll("addonIds").length > 0 ? form.getAll("addonIds") : undefined,
      paymentMethod: form.get("paymentMethod") || undefined,
      agreedToRules: form.get("agreedToRules") === "on",
    };
  } else {
    body = await req.json().catch(() => null);
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    if (isFormPost) {
      const message = parsed.error.issues[0]?.message ?? "Please check the form and try again.";
      const url = new URL("/pricing", req.url);
      url.searchParams.set("error", message);
      const templateId = (body as { templateId?: string })?.templateId;
      if (templateId) url.searchParams.set("template", templateId);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { templateId, programId, couponCode, platformId, addonIds, paymentMethod } = parsed.data;
  const agreedAt = new Date();

  function fail(status: number, message: string) {
    if (isFormPost) {
      const url = new URL("/pricing", req.url);
      url.searchParams.set("error", message);
      url.searchParams.set("template", templateId);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: message }, { status });
  }

  const template = await prisma.challengeTemplate.findUnique({ where: { id: templateId } });
  if (!template || !template.active) {
    return fail(404, "Challenge template not found.");
  }

  let program = null;
  if (programId) {
    program = await prisma.challengeProgram.findUnique({ where: { id: programId } });
    if (!program || !program.active) {
      return fail(404, "Selected program not found.");
    }
  }

  if (paymentMethod) {
    const method = await prisma.paymentMethod.findUnique({ where: { key: paymentMethod } });
    if (!method || !method.enabled) {
      return fail(400, "Selected payment method isn't available.");
    }
  }

  // Platform is optional, but if one was picked, the (template, platform)
  // combination must actually be allowed by the availability engine — never
  // trust the frontend's own idea of what's available.
  let platformFeeCents = 0;
  if (platformId) {
    const platform = await prisma.tradingPlatform.findUnique({ where: { id: platformId } });
    if (!platform || !platform.active) {
      return fail(404, "Selected trading platform not found.");
    }
    const availability = await prisma.platformAvailability.findUnique({
      where: { templateId_platformId: { templateId: template.id, platformId } },
    });
    if (availability && !availability.allowed) {
      return fail(400, availability.unavailableReason ?? "This platform isn't available for the selected account size.");
    }
    platformFeeCents = availability?.feeCents ?? 0;
  }

  // Add-ons are optional, but each one must actually be active and allowed
  // for this template — never trust the frontend's list of what's on offer.
  let addons: { id: string; priceCents: number }[] = [];
  if (addonIds && addonIds.length > 0) {
    const found = await prisma.addon.findMany({ where: { id: { in: addonIds }, active: true } });
    if (found.length !== addonIds.length) {
      return fail(400, "One or more selected add-ons are no longer available.");
    }
    const availabilityRows = await prisma.addonAvailability.findMany({
      where: { templateId: template.id, addonId: { in: addonIds } },
    });
    const blocked = availabilityRows.find((a) => !a.allowed);
    if (blocked) {
      return fail(400, "One or more selected add-ons aren't available for this account size.");
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

  // "Add another account" discount: automatic, based on how many paid
  // orders this trader already has — never combined with a manual coupon.
  let discountCents = priceCalc.discountCents;
  if (!priceCalc.couponValid) {
    const multiDiscount = await getMultiAccountDiscountPct(session.user.id);
    if (multiDiscount) {
      discountCents = Math.round((template.priceCents * multiDiscount.pct) / 100);
    }
  }

  const order = await prisma.order.create({
    data: {
      userId: session.user.id,
      templateId: template.id,
      programId: program?.id,
      couponId: priceCalc.couponValid ? coupon?.id : undefined,
      platformId: platformId ?? undefined,
      paymentMethod: paymentMethod ?? undefined,
      subtotalCents: priceCalc.subtotalCents,
      discountCents,
      platformFeeCents,
      totalCents: priceCalc.subtotalCents - discountCents + platformFeeCents + addonTotalCents,
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
    const url = `${baseUrl}/checkout/pay?orderId=${order.id}`;
    if (isFormPost) return NextResponse.redirect(url, 303);
    return NextResponse.json({ url, orderId: order.id, devMode: true });
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

    if (isFormPost && checkoutSession.url) return NextResponse.redirect(checkoutSession.url, 303);
    return NextResponse.json({ url: checkoutSession.url, orderId: order.id });
  } catch (err) {
    // In local/dev environments without real Stripe keys, this call fails.
    // We still return the created order so the flow can be exercised.
    if (isFormPost) return NextResponse.redirect(`${baseUrl}/checkout/pay?orderId=${order.id}`, 303);
    return NextResponse.json(
      { error: "Stripe checkout session could not be created (dev mode?).", orderId: order.id, detail: (err as Error).message },
      { status: 502 }
    );
  }
}
