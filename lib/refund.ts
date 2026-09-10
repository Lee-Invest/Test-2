import { prisma } from "./prisma";

/**
 * Marks an account's original evaluation-fee order as eligible for a 100%
 * refund. Called the moment an account first reaches the FUNDED phase
 * (both the lazy on-read auto-advance path and the manual admin
 * MARK_FUNDED/SET_PHASE actions), never retroactively and never twice —
 * refundEligibleAt is only ever set once.
 */
export async function markOrderRefundEligible(accountId: string): Promise<void> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { orderId: true, userId: true },
  });
  if (!account?.orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: account.orderId },
    select: { id: true, refundEligibleAt: true, totalCents: true },
  });
  if (!order || order.refundEligibleAt) return;

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { refundEligibleAt: new Date() },
    }),
    prisma.notification.create({
      data: {
        userId: account.userId,
        type: "SUCCESS",
        title: "Evaluation fee refunded",
        body: "You've reached a funded account — your one-time evaluation fee is now eligible for a 100% refund.",
      },
    }),
  ]);
}
