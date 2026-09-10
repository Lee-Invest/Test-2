import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

// Loads a shared configuration by its random token and redirects to
// /pricing with the same selection pre-filled via query params — the token
// itself carries no sensitive data, it's purely a lookup key.
export default async function SharedConfigPage({ params }: { params: { token: string } }) {
  const config = await prisma.savedConfiguration.findUnique({ where: { shareToken: params.token } });

  const url = new URLSearchParams();
  if (config) {
    url.set("template", config.templateId);
    if (config.platformId) url.set("platform", config.platformId);
    if (config.programId) url.set("program", config.programId);
    for (const id of config.addonIds) url.append("addon", id);
  } else {
    url.set("error", "This shared configuration link is invalid or has expired.");
  }

  redirect(`/pricing?${url.toString()}`);
}
