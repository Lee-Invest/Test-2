import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Nav } from "@/components/nav";
import { formatCents } from "@/lib/utils";
import { getDashboardAccounts } from "@/lib/dashboard-data";
import { DashboardTabs } from "@/components/dashboard-tabs";

const PHASES = ["PHASE_1", "PHASE_2", "FUNDED"];

// Server-rendered: the account/trade/risk data is fetched and computed here,
// server-side, so the page shows real content in its initial HTML rather
// than depending on a client-side fetch-after-mount to ever run.
export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?next=/dashboard");

  const accounts = await getDashboardAccounts(session.user.id);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Trader Dashboard</h1>
        <DashboardTabs active="overview" />

        {accounts.length === 0 && (
          <p className="mt-8 text-gray-500">
            You don&apos;t have any challenge accounts yet.{" "}
            <a href="/pricing" className="text-[var(--brand-accent)]">
              Start a challenge
            </a>
            .
          </p>
        )}

        {accounts.map((account) => (
          <section key={account.id} className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">${account.accountSize.toLocaleString()} Account</div>
                <div className="text-2xl font-bold text-gray-900">{formatCents(account.currentEquityCents)}</div>
              </div>
              <PhaseTracker current={account.currentPhase?.type ?? "PHASE_1"} />
            </div>

            {account.isFailed && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="text-sm font-semibold text-red-800">Account Failed</div>
                <p className="mt-1 text-sm text-red-700">
                  {account.breachEvent?.message ?? "This account breached a risk rule and is no longer active."}
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Metric label="Balance" value={formatCents(account.currentBalanceCents)} />
              <Metric label="Equity" value={formatCents(account.currentEquityCents)} />
              <Metric
                label="P/L since start"
                value={formatCents(account.currentEquityCents - account.startingBalanceCents)}
              />
            </div>

            {account.risk && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <RiskBar
                  label="Daily Loss Used"
                  usedPct={account.risk.dailyLossPctUsed}
                  remainingPct={account.risk.dailyLossRemainingPct}
                  breached={account.risk.dailyLossBreached}
                />
                <RiskBar
                  label="Overall Loss Used"
                  usedPct={account.risk.overallLossPctUsed}
                  remainingPct={account.risk.overallLossRemainingPct}
                  breached={account.risk.overallLossBreached}
                />
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Metric label="Win Rate" value={`${account.stats.winRatePct}%`} />
              <Metric label="Profit Factor" value={account.stats.profitFactor?.toString() ?? "—"} />
              <Metric label="Avg Win" value={formatCents(account.stats.avgWinCents)} />
              <Metric label="Avg Loss" value={formatCents(account.stats.avgLossCents)} />
            </div>

            {account.isFunded && (
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-green-200 bg-green-50 p-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-green-700">Available payout</div>
                  <div className="text-lg font-semibold text-green-900">
                    {formatCents(account.availablePayoutCents)}{" "}
                    <span className="text-sm font-normal text-green-700">({account.profitSplitTraderPct}% split)</span>
                  </div>
                </div>
                <a
                  href="/dashboard/payouts"
                  className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  Request Payout
                </a>
              </div>
            )}

            {account.refund?.eligible && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-amber-700">Evaluation fee refund</div>
                  <div className="text-lg font-semibold text-amber-900">
                    {formatCents(account.refund.amountCents)}{" "}
                    <span className="text-sm font-normal text-amber-700">(100% — you reached a funded account)</span>
                  </div>
                </div>
                <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-900">
                  {account.refund.refunded ? "Refunded" : "Processing"}
                </span>
              </div>
            )}

            <div className="mt-8">
              <h3 className="font-semibold text-gray-900">Trade History</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-400">
                    <tr>
                      <th className="py-2 pr-4">Symbol</th>
                      <th className="py-2 pr-4">Side</th>
                      <th className="py-2 pr-4">Opened</th>
                      <th className="py-2 pr-4">Closed</th>
                      <th className="py-2 pr-4">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.trades.map((t) => (
                      <tr key={t.id} className="border-t border-gray-100">
                        <td className="py-2 pr-4 text-gray-900">{t.symbol}</td>
                        <td className="py-2 pr-4 text-gray-900">{t.side}</td>
                        <td className="py-2 pr-4 text-gray-900">{new Date(t.openedAt).toLocaleDateString()}</td>
                        <td className="py-2 pr-4 text-gray-900">
                          {t.closedAt ? new Date(t.closedAt).toLocaleDateString() : "Open"}
                        </td>
                        <td className={`py-2 pr-4 ${t.pnlCents !== null && t.pnlCents < 0 ? "text-red-600" : "text-green-600"}`}>
                          {t.pnlCents !== null ? formatCents(t.pnlCents) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        ))}
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

function RiskBar({
  label,
  usedPct,
  remainingPct,
  breached,
}: {
  label: string;
  usedPct: number;
  remainingPct: number;
  breached: boolean;
}) {
  const total = usedPct + remainingPct || 1;
  const pct = Math.min(100, (usedPct / total) * 100);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className={breached ? "text-red-600 font-semibold" : ""}>{usedPct}% used</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
        <div
          className={`h-2 rounded-full ${breached ? "bg-red-500" : "bg-[var(--brand-accent)]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function PhaseTracker({ current }: { current: string }) {
  const idx = PHASES.indexOf(current);
  return (
    <div className="flex items-center gap-2 text-xs">
      {PHASES.map((p, i) => (
        <div key={p} className="flex items-center gap-2">
          <div
            className={`rounded-full px-3 py-1 font-semibold ${
              i <= idx ? "bg-[var(--brand-primary)] text-white" : "bg-gray-100 text-gray-400"
            }`}
          >
            {p.replace("_", " ")}
          </div>
          {i < PHASES.length - 1 && <span className="text-gray-300">→</span>}
        </div>
      ))}
    </div>
  );
}
