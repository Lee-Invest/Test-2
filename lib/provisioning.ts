import { prisma } from "@/lib/prisma";

/**
 * Provisions a paid Order into a live trading Account + initial
 * ChallengePhase (PHASE_1). Called from the Stripe webhook handler once
 * `checkout.session.completed` has been verified. Idempotent: if the order
 * already has an account, does nothing further.
 */
export async function provisionOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { template: true, account: true },
  });

  if (!order) throw new Error(`Order ${orderId} not found`);
  if (order.account) return order.account; // already provisioned

  const startingBalanceCents = order.template.accountSize * 100;

  const account = await prisma.account.create({
    data: {
      userId: order.userId,
      templateId: order.templateId,
      orderId: order.id,
      platformId: order.platformId,
      startingBalanceCents,
      currentBalanceCents: startingBalanceCents,
      currentEquityCents: startingBalanceCents,
      highestBalanceCents: startingBalanceCents,
      dayStartEquityCents: startingBalanceCents,
      phases: {
        create: {
          type: "PHASE_1",
          status: "ACTIVE",
          profitTargetPct: order.template.phase1ProfitTargetPct,
          maxDailyLossPct: order.template.maxDailyLossPct,
          maxOverallLossPct: order.template.maxOverallLossPct,
          minTradingDays: order.template.phase1MinTradingDays,
        },
      },
    },
    include: { phases: true },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { status: "PAID" },
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      type: "SUCCESS",
      title: "Your challenge account is live",
      body: `Your $${order.template.accountSize.toLocaleString()} Phase 1 account has been created. Good luck!`,
    },
  });

  return account;
}
