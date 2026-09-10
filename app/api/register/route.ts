import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const rl = rateLimit(`register:${ip}`, 5, 60_000);
  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost = contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data");

  if (!rl.allowed) {
    if (isFormPost) {
      return NextResponse.redirect(new URL("/register?error=Too+many+requests.+Try+again+shortly.", req.url), 303);
    }
    return NextResponse.json({ error: "Too many requests. Try again shortly." }, { status: 429 });
  }

  let raw: unknown;
  if (isFormPost) {
    const form = await req.formData();
    raw = { name: form.get("name"), email: form.get("email"), password: form.get("password") };
  } else {
    raw = await req.json().catch(() => null);
  }

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    if (isFormPost) {
      const message = parsed.error.flatten().formErrors[0] ?? "Please check the form and try again.";
      const name = typeof (raw as { name?: unknown })?.name === "string" ? (raw as { name: string }).name : "";
      const email = typeof (raw as { email?: unknown })?.email === "string" ? (raw as { email: string }).email : "";
      const url = new URL("/register", req.url);
      url.searchParams.set("error", message);
      if (name) url.searchParams.set("name", name);
      if (email) url.searchParams.set("email", email);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    if (isFormPost) {
      const url = new URL("/register", req.url);
      url.searchParams.set("error", "An account with this email already exists.");
      url.searchParams.set("name", name);
      url.searchParams.set("email", email);
      return NextResponse.redirect(url, 303);
    }
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email: normalizedEmail, passwordHash, role: "TRADER" },
    select: { id: true, email: true, name: true },
  });

  if (isFormPost) {
    const url = new URL("/login", req.url);
    url.searchParams.set("registered", "1");
    url.searchParams.set("email", user.email);
    return NextResponse.redirect(url, 303);
  }

  return NextResponse.json({ user }, { status: 201 });
}
