import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const [revenue, activeTraders, phases, fundedCount] = await Promise.all([
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
    prisma.account.count({ where: { isActive: true } }),
    prisma.challengePhase.groupBy({ by: ["status"], _count: true }),
    prisma.challengePhase.count({ where: { type: "FUNDED" } }),
  ]);

  const passed = phases.find((p) => p.status === "PASSED")?._count ?? 0;
  const failed = phases.find((p) => p.status === "FAILED")?._count ?? 0;
  const totalDecided = passed + failed;

  return NextResponse.json({
    revenueCents: revenue._sum.totalCents ?? 0,
    activeTraders,
    passRate: totalDecided > 0 ? Math.round((passed / totalDecided) * 100) : 0,
    failRate: totalDecided > 0 ? Math.round((failed / totalDecided) * 100) : 0,
    fundedCount,
  });
}
