import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validation";
import { sendMail } from "@/lib/mailer";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`forgot:${ip}`, 5, 60_000);
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  if (!rl.allowed) {
    if (isFormPost) return NextResponse.redirect(new URL("/forgot-password?error=Too+many+requests.", req.url), 303);
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = isFormPost ? { email: (await req.formData()).get("email") } : await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    if (isFormPost) return NextResponse.redirect(new URL("/forgot-password?error=Enter+a+valid+email.", req.url), 303);
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return 200 regardless of whether the user exists, to avoid
  // leaking account existence.
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 1000 * 60 * 30); // 30 min
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry },
    });
    const resetUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/reset-password?token=${token}`;
    await sendMail(email, "Reset your ApexFund password", `Reset your password: ${resetUrl}`);
  }

  if (isFormPost) return NextResponse.redirect(new URL("/forgot-password?sent=1", req.url), 303);
  return NextResponse.json({ ok: true });
}
