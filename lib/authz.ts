import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SUPER_ADMIN")) {
    return { session: null, error: "Forbidden: admin access required." } as const;
  }
  return { session, error: null } as const;
}

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { session: null, error: "Unauthorized." } as const;
  }
  return { session, error: null } as const;
}
