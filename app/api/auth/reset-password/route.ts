import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  const body = isFormPost
    ? Object.fromEntries((await req.formData()).entries())
    : await req.json().catch(() => null);
  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    if (isFormPost) {
      const token = (body as { token?: string })?.token ?? "";
      const url = new URL("/reset-password", req.url);
      url.searchParams.set("token", token);
      url.searchParams.set("error", parsed.error.issues[0]?.message ?? "Please check the form and try again.");
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { token, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { resetToken: token } });

  if (!user || !user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
    if (isFormPost) {
      const url = new URL("/reset-password", req.url);
      url.searchParams.set("token", token);
      url.searchParams.set("error", "Invalid or expired reset token.");
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  if (isFormPost) return NextResponse.redirect(new URL("/login?reset=1", req.url), 303);
  return NextResponse.json({ ok: true });
}
