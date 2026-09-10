import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { templateUpsertSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Admin-only CRUD for ChallengeTemplates. All numeric business rules
// (pricing, targets, drawdown %, min days, profit split) are mutated ONLY
// through this authenticated, role-checked route — never client-writable.

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const templates = await prisma.challengeTemplate.findMany({ orderBy: { accountSize: "asc" } });
  return NextResponse.json({ templates });
}

const NUMERIC_FIELDS = [
  "accountSize",
  "priceCents",
  "phase1ProfitTargetPct",
  "phase1MinTradingDays",
  "phase2ProfitTargetPct",
  "phase2MinTradingDays",
  "maxDailyLossPct",
  "maxOverallLossPct",
  "profitSplitTraderPct",
] as const;

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
    body = {
      ...form,
      active: form.active === "on",
      ...Object.fromEntries(NUMERIC_FIELDS.map((f) => [f, Number(form[f])])),
    };
  } else {
    body = await req.json().catch(() => null);
  }

  const parsed = templateUpsertSchema.safeParse(body);
  if (!parsed.success) {
    if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=templates&error=Invalid+template+data.", req.url), 303);
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  const template = id
    ? await prisma.challengeTemplate.update({ where: { id }, data })
    : await prisma.challengeTemplate.create({ data });

  if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=templates", req.url), 303);
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
