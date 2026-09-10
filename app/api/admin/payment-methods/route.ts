import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

// Admin-only toggle for which payment methods are shown at checkout. This
// is a display/architecture layer only — enabling a method here does not by
// itself wire up a live payment gateway integration for it.

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status: 403 });

  const methods = await prisma.paymentMethod.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ methods });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  const { error } = await requireAdmin();
  if (error) {
    if (isFormPost) return NextResponse.redirect(new URL("/login?next=/admin", req.url), 303);
    return NextResponse.json({ error }, { status: 403 });
  }

  const body = isFormPost ? Object.fromEntries((await req.formData()).entries()) : await req.json().catch(() => null);
  const id = typeof (body as { id?: unknown })?.id === "string" ? (body as { id: string }).id : null;
  if (!id) {
    if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=payments&error=Invalid+payment+method.", req.url), 303);
    return NextResponse.json({ error: "id is required." }, { status: 400 });
  }

  const method = await prisma.paymentMethod.findUnique({ where: { id } });
  if (!method) {
    if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=payments&error=Payment+method+not+found.", req.url), 303);
    return NextResponse.json({ error: "Payment method not found." }, { status: 404 });
  }

  await prisma.paymentMethod.update({ where: { id }, data: { enabled: !method.enabled } });

  if (isFormPost) return NextResponse.redirect(new URL("/admin?tab=payments", req.url), 303);
  return NextResponse.json({ ok: true });
}
