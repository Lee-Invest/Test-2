import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public read-only endpoint used by the pricing page to render live config.
export async function GET() {
  const templates = await prisma.challengeTemplate.findMany({
    where: { active: true },
    orderBy: { accountSize: "asc" },
  });
  return NextResponse.json({ templates });
}
