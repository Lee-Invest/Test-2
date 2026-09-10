import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { formatCents } from "@/lib/utils";
import { getPayoutsView } from "@/lib/dashboard-data";
import { DashboardTabs } from "@/components/dashboard-tabs";

const PAYOUT_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  PAID: "bg-green-100 text-green-800",
};

// Server-rendered, same reasoning as /dashboard: payout history and
// eligibility are computed here directly, and "Request Payout" is a plain
// <form> posting to /api/payouts (native browser POST + redirect), so
// nothing on this page depends on client JS having mounted.
export default async function PayoutsPage({ searchParams }: { searchParams: { error?: string; requested?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?next=/dashboard/payouts");

  const { payouts, eligibility } = await getPayoutsView(session.user.id);
  const requestable = eligibility.filter((e) => e.eligible);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Trader Dashboard</h1>
        <DashboardTabs active="payouts" />

        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Payout History</h2>

          {searchParams.requested && (
            <p className="mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
              Payout requested successfully.
            </p>
          )}
          {searchParams.error && (
            <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
          )}

          {requestable.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-3">
              {requestable.map((e) => (
                <form key={e.accountId} action="/api/payouts" method="POST">
                  <input type="hidden" name="accountId" value={e.accountId} />
                  <button
                    type="submit"
                    className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Request payout — ${e.accountSize.toLocaleString()} account ({formatCents(e.availableCents)})
                  </button>
                </form>
              ))}
            </div>
          )}

          {payouts.length === 0 && (
            <p className="mt-4 text-gray-500">
              No payouts yet. Once an account reaches Funded status and is eligible, you can request a payout above.
            </p>
          )}

          {payouts.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-400">
                  <tr>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Requested</th>
                    <th className="py-2 pr-4">Trader Share</th>
                    <th className="py-2 pr-4">Firm Share</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-2 pr-4 text-gray-900">${p.account.template.accountSize.toLocaleString()}</td>
                      <td className="py-2 pr-4 text-gray-900">{new Date(p.requestedAt).toLocaleDateString()}</td>
                      <td className="py-2 pr-4 font-semibold text-gray-900">{formatCents(p.traderShareCents)}</td>
                      <td className="py-2 pr-4 text-gray-500">{formatCents(p.firmShareCents)}</td>
                      <td className="py-2 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PAYOUT_STATUS_STYLE[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-500">
                        {p.processedAt ? new Date(p.processedAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  );
}
