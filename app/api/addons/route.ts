import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Public, read-only view of purchasable add-ons + per-template availability
// — same shape/pattern as /api/platforms.
export async function GET() {
  const [addons, availability] = await Promise.all([
    prisma.addon.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.addonAvailability.findMany(),
  ]);

  return NextResponse.json({ addons, availability });
}
