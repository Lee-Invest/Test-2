import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { templateUpsertSchema } from "@/lib/validation";

// Admin-only CRUD for ChallengeTemplates. All numeric business rules
// (pricing, targets, drawdown %, min days, profit split) are mutated ONLY
// through this authenticated, role-checked route — never client-writable.

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const templates = await prisma.challengeTemplate.findMany({ orderBy: { accountSize: "asc" } });
  return NextResponse.json({ templates });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = templateUpsertSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { id, ...data } = parsed.data;

  const template = id
    ? await prisma.challengeTemplate.update({ where: { id }, data })
    : await prisma.challengeTemplate.create({ data });

  return NextResponse.json({ template });
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const { id } = await req.json().catch(() => ({ id: null }));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // Soft-delete via `active: false` to preserve referential history on
  // existing orders/accounts.
  const template = await prisma.challengeTemplate.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ template });
}
