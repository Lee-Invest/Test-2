import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public, read-only view of the platform availability engine: every active
// platform, and for each ChallengeTemplate (account size) whether it's
// allowed plus any platform fee. The configurator reads this instead of
// ever branching on account size or platform name in application code.
export async function GET() {
  const [platforms, availability] = await Promise.all([
    prisma.tradingPlatform.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.platformAvailability.findMany(),
  ]);

  return NextResponse.json({ platforms, availability });
}
