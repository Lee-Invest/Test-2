import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const [platforms, templates, availability] = await Promise.all([
    prisma.tradingPlatform.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.challengeTemplate.findMany({ orderBy: { accountSize: "asc" } }),
    prisma.platformAvailability.findMany(),
  ]);

  return NextResponse.json({ platforms, templates, availability });
}

const toggleSchema = z.object({
  action: z.literal("TOGGLE_AVAILABILITY"),
  templateId: z.string().min(1),
  platformId: z.string().min(1),
});

const feeSchema = z.object({
  action: z.literal("SET_FEE"),
  templateId: z.string().min(1),
  platformId: z.string().min(1),
  feeCents: z.number().int().min(0),
});

const activeSchema = z.object({
  action: z.literal("TOGGLE_ACTIVE"),
  platformId: z.string().min(1),
});

const bodySchema = z.union([toggleSchema, feeSchema, activeSchema]);

// Admin-only writes to the platform availability engine — the same table
// /api/checkout and /api/platforms read from, so a change here takes effect
// immediately for every trader without touching application code.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error || !session) return NextResponse.json({ error }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.action === "TOGGLE_ACTIVE") {
    const platform = await prisma.tradingPlatform.findUnique({ where: { id: parsed.data.platformId } });
    if (!platform) return NextResponse.json({ error: "Platform not found." }, { status: 404 });
    await prisma.tradingPlatform.update({ where: { id: platform.id }, data: { active: !platform.active } });
    return NextResponse.json({ ok: true });
  }

  const { templateId, platformId } = parsed.data;
  const existing = await prisma.platformAvailability.findUnique({
    where: { templateId_platformId: { templateId, platformId } },
  });

  if (parsed.data.action === "TOGGLE_AVAILABILITY") {
    await prisma.platformAvailability.upsert({
      where: { templateId_platformId: { templateId, platformId } },
      update: { allowed: !(existing?.allowed ?? true) },
      create: { templateId, platformId, allowed: false },
    });
  } else {
    await prisma.platformAvailability.upsert({
      where: { templateId_platformId: { templateId, platformId } },
      update: { feeCents: parsed.data.feeCents },
      create: { templateId, platformId, feeCents: parsed.data.feeCents },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: `PLATFORM_${parsed.data.action}`,
      targetType: "PlatformAvailability",
      targetId: `${templateId}:${platformId}`,
      metadata: parsed.data,
    },
  });

  return NextResponse.json({ ok: true });
}
