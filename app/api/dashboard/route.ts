import { NextResponse } from "next/server";
import { requireUser } from "@/lib/authz";
import { getDashboardAccounts } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

// Read-only aggregate view for the trader dashboard. All figures are
// computed server-side from stored Trade/Account rows via the risk engine —
// a trader has no write path to balance/phase/status here. The
// server-rendered /dashboard page no longer depends on this for its initial
// render (see lib/dashboard-data.ts); this stays available for any
// client-side refresh.
export async function GET() {
  const { session, error } = await requireUser();
  if (error || !session) return NextResponse.json({ error }, { status: 401 });

  const accounts = await getDashboardAccounts(session.user.id);
  return NextResponse.json({ accounts });
}
