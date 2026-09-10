import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const [addons, templates, availability] = await Promise.all([
    prisma.addon.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.challengeTemplate.findMany({ orderBy: { accountSize: "asc" } }),
    prisma.addonAvailability.findMany(),
  ]);

  return NextResponse.json({ addons, templates, availability });
}

const createSchema = z.object({
  action: z.literal("CREATE"),
  name: z.string().min(2),
  slug: z.string().min(2),
  description: z.string().min(1),
  priceCents: z.number().int().min(0),
  billing: z.enum(["ONE_TIME", "MONTHLY"]).default("ONE_TIME"),
});

const toggleActiveSchema = z.object({
  action: z.literal("TOGGLE_ACTIVE"),
  addonId: z.string().min(1),
});

const toggleAvailabilitySchema = z.object({
  action: z.literal("TOGGLE_AVAILABILITY"),
  addonId: z.string().min(1),
  templateId: z.string().min(1),
});

const bodySchema = z.union([createSchema, toggleActiveSchema, toggleAvailabilitySchema]);

// Admin-only writes for the add-on catalog. Same table /api/addons and
// /api/checkout read from, so a change here is live immediately.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAdmin();
  if (error || !session) return NextResponse.json({ error }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.action === "CREATE") {
    const { name, slug, description, priceCents, billing } = parsed.data;
    const addon = await prisma.addon.create({ data: { name, slug, description, priceCents, billing } });
    return NextResponse.json({ addon });
  }

  if (parsed.data.action === "TOGGLE_ACTIVE") {
    const addon = await prisma.addon.findUnique({ where: { id: parsed.data.addonId } });
    if (!addon) return NextResponse.json({ error: "Add-on not found." }, { status: 404 });
    await prisma.addon.update({ where: { id: addon.id }, data: { active: !addon.active } });
    return NextResponse.json({ ok: true });
  }

  const { addonId, templateId } = parsed.data;
  const existing = await prisma.addonAvailability.findUnique({
    where: { templateId_addonId: { templateId, addonId } },
  });
  await prisma.addonAvailability.upsert({
    where: { templateId_addonId: { templateId, addonId } },
    update: { allowed: !(existing?.allowed ?? true) },
    create: { templateId, addonId, allowed: false },
  });

  await prisma.auditLog.create({
    data: {
      actorId: session.user.id,
      action: `ADDON_${parsed.data.action}`,
      targetType: "AddonAvailability",
      targetId: `${templateId}:${addonId}`,
      metadata: parsed.data,
    },
  });

  return NextResponse.json({ ok: true });
}
