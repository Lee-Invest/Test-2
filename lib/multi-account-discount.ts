import { prisma } from "./prisma";

/**
 * "Add another account" pricing: the Nth paid account a trader buys can
 * carry a configurable discount (see the MultiAccountDiscount table, admin
 * -managed). Applied automatically at checkout based on how many PAID
 * orders the trader already has — never a hardcoded tier in application
 * code, and only when no manual coupon was used (the two never stack).
 */
export async function getMultiAccountDiscountPct(userId: string): Promise<{ index: number; pct: number } | null> {
  const paidOrderCount = await prisma.order.count({ where: { userId, status: "PAID" } });
  const accountIndex = paidOrderCount + 1;
  if (accountIndex < 2) return null;

  const row = await prisma.multiAccountDiscount.findUnique({ where: { accountIndex } });
  if (!row || !row.active) return null;

  return { index: accountIndex, pct: Number(row.discountPct) };
}
