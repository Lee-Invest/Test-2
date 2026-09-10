import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { programUpsertSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Admin-only CRUD for ChallengePrograms (2-Step, 1-Step, Instant Funding,
// Futures, ...). phaseCount is the only field with real behavioral effect
// (see lib/provisioning.ts / lib/phase-transition.ts) — everything else is
// display metadata.

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const programs = await prisma.challengeProgram.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ programs });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  const { error } = await requireAdmin();
  if (error) {
    if (isFormPost) return NextResponse.redirect(new URL("/login?next=/admin", req.url), 303);
    return NextResponse.json({ error }, { status: 403 });
  }

  let body: unknown;
  if (isFormPost) {
    const form = Object.fromEntries((await req.formData()).entries());
    body = { ...form, phaseCount: Number(form.phaseCount), active: form.active === "on", mostPopular: form.mostPopular === "on" };
  } else {
    body = await req.json().catch(() => null);
  }

  const parsed = programUpsertSchema.safeParse(body);
  if (!parsed.success) {
    if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=programs&error=Invalid+program+data.", req.url), 303);
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;
  const program = id
    ? await prisma.challengeProgram.update({ where: { id }, data })
    : await prisma.challengeProgram.create({ data: { ...data, sortOrder: await nextSortOrder() } });

  if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=programs", req.url), 303);
  return NextResponse.json({ program });
}

async function nextSortOrder() {
  const count = await prisma.challengeProgram.count();
  return count;
}
