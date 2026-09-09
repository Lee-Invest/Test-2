import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { provisionOrder } from "@/lib/provisioning";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${(err as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await prisma.payment.upsert({
        where: { orderId },
        create: {
          orderId,
          amountCents: session.amount_total ?? 0,
          status: "SUCCEEDED",
          provider: "stripe",
          providerRef: session.payment_intent as string | undefined,
        },
        update: {
          status: "SUCCEEDED",
          providerRef: session.payment_intent as string | undefined,
        },
      });
      await provisionOrder(orderId);
    }
  }

  return NextResponse.json({ received: true });
}
