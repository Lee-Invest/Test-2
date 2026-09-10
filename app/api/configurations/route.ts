import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveConfigurationSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// "Save configuration" (requires login, appears on the dashboard) and
// "Share" (works for anyone, generates a token-based URL that reloads the
// same selection — no sensitive data in the token, it's just a random
// lookup key) both go through this one endpoint via a native form post.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const action = form.get("action");

  const body = {
    name: form.get("name") || "My configuration",
    templateId: form.get("templateId") || undefined,
    platformId: form.get("platformId") || undefined,
    programId: form.get("programId") || undefined,
    addonIds: form.getAll("addonIds").length > 0 ? form.getAll("addonIds") : undefined,
  };
  const parsed = saveConfigurationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.redirect(new URL("/pricing?error=Could+not+save+that+configuration.", req.url), 303);
  }

  const backToPricing = new URL("/pricing", req.url);
  backToPricing.searchParams.set("template", parsed.data.templateId);
  if (parsed.data.platformId) backToPricing.searchParams.set("platform", parsed.data.platformId);
  if (parsed.data.programId) backToPricing.searchParams.set("program", parsed.data.programId);
  for (const id of parsed.data.addonIds ?? []) backToPricing.searchParams.append("addon", id);

  if (action === "save") {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.redirect(new URL("/login?next=/pricing", req.url), 303);

    await prisma.savedConfiguration.create({
      data: {
        userId: session.user.id,
        name: parsed.data.name,
        templateId: parsed.data.templateId,
        platformId: parsed.data.platformId,
        programId: parsed.data.programId,
        addonIds: parsed.data.addonIds ?? [],
      },
    });

    backToPricing.searchParams.set("saved", "1");
    return NextResponse.redirect(backToPricing, 303);
  }

  if (action === "share") {
    const shareToken = crypto.randomBytes(9).toString("base64url");
    await prisma.savedConfiguration.create({
      data: {
        name: parsed.data.name,
        templateId: parsed.data.templateId,
        platformId: parsed.data.platformId,
        programId: parsed.data.programId,
        addonIds: parsed.data.addonIds ?? [],
        shareToken,
      },
    });

    const shareUrl = new URL(`/challenge/config/${shareToken}`, req.url).toString();
    backToPricing.searchParams.set("shareUrl", shareUrl);
    return NextResponse.redirect(backToPricing, 303);
  }

  return NextResponse.redirect(new URL("/pricing?error=Unknown+action.", req.url), 303);
}
