import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isStripeConfigured } from "@/lib/stripe";
import { provisionOrder } from "@/lib/provisioning";
import { z } from "zod";

export const dynamic = "force-dynamic";

const confirmSchema = z.object({ orderId: z.string().min(1) });

/**
 * Dev-only "pay" confirmation for the simulated checkout page
 * (app/checkout/pay). Only reachable when no real Stripe account is
 * configured — with real Stripe keys set, payment confirmation only ever
 * happens through the signature-verified webhook
 * (app/api/webhooks/stripe), never through a client-callable route like
 * this one. Still requires the caller to be signed in as the order's owner.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const orderId = req.nextUrl.searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { template: true } });
  if (!order || order.userId !== session.user.id) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  return NextResponse.json({
    orderId: order.id,
    templateName: order.template.name,
    accountSize: order.template.accountSize,
    totalCents: order.totalCents,
    status: order.status,
  });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  if (isStripeConfigured) {
    if (isFormPost) return NextResponse.redirect(new URL("/pricing", req.url), 303);
    return NextResponse.json({ error: "Not available: a real Stripe account is configured." }, { status: 403 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    if (isFormPost) return NextResponse.redirect(new URL("/login?next=/pricing", req.url), 303);
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const body = isFormPost ? { orderId: (await req.formData()).get("orderId") } : await req.json().catch(() => null);
  const parsed = confirmSchema.safeParse(body);
  if (!parsed.success) {
    if (isFormPost) return NextResponse.redirect(new URL("/pricing?error=orderId+is+required.", req.url), 303);
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: parsed.data.orderId } });
  if (!order || order.userId !== session.user.id) {
    if (isFormPost) return NextResponse.redirect(new URL("/pricing?error=Order+not+found.", req.url), 303);
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }


  await provisionOrder(order.id);

  if (isFormPost) return NextResponse.redirect(new URL(`/checkout/success?orderId=${order.id}`, req.url), 303);
  return NextResponse.json({ ok: true, orderId: order.id });
}
