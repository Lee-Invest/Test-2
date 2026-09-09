"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { formatCents } from "@/lib/utils";

interface Trade {
  id: string;
  symbol: string;
  side: "LONG" | "SHORT";
  pnlCents: number | null;
  openedAt: string;
  closedAt: string | null;
}

interface AccountView {
  id: string;
  accountSize: number;
  startingBalanceCents: number;
  currentBalanceCents: number;
  currentEquityCents: number;
  isActive: boolean;
  currentPhase: { type: string; status: string; tradingDays: number } | null;
  risk: {
    dailyLossPctUsed: number;
    dailyLossRemainingPct: number;
    dailyLossBreached: boolean;
    overallLossPctUsed: number;
    overallLossRemainingPct: number;
    overallLossBreached: boolean;
    profitPct: number;
    profitTargetMet: boolean;
    minTradingDaysMet: boolean;
  } | null;
  stats: {
    totalTrades: number;
    winRatePct: number;
    profitFactor: number | null;
    avgWinCents: number;
    avgLossCents: number;
    netPnlCents: number;
  };
  trades: Trade[];
}

const PHASES = ["PHASE_1", "PHASE_2", "FUNDED"];

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [filterSide, setFilterSide] = useState<string>("ALL");
  const [filterSymbol, setFilterSymbol] = useState<string>("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []));
  }, []);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold">Trader Dashboard</h1>

        {accounts === null && <p className="mt-8 text-white/50">Loading…</p>}
        {accounts?.length === 0 && (
          <p className="mt-8 text-white/50">
            You don&apos;t have any challenge accounts yet. <a href="/pricing" className="text-[var(--brand-accent)]">Start a challenge</a>.
          </p>
        )}

        {accounts?.map((account) => (
          <section key={account.id} className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-sm text-white/50">${account.accountSize.toLocaleString()} Account</div>
                <div className="text-2xl font-bold">{formatCents(account.currentEquityCents)}</div>
              </div>
              <PhaseTracker current={account.currentPhase?.type ?? "PHASE_1"} />
            </div>

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

            <div className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">Trade History</h3>
                <div className="flex gap-2">
                  <input
                    placeholder="Filter symbol…"
                    value={filterSymbol}
                    onChange={(e) => setFilterSymbol(e.target.value)}
                    className="rounded-md border border-white/15 bg-transparent px-2 py-1 text-xs"
                  />
                  <select
                    value={filterSide}
                    onChange={(e) => setFilterSide(e.target.value)}
                    className="rounded-md border border-white/15 bg-[#0b0b14] px-2 py-1 text-xs"
                  >
                    <option value="ALL">All sides</option>
                    <option value="LONG">Long</option>
                    <option value="SHORT">Short</option>
                  </select>
                </div>
              </div>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-white/40">
                    <tr>
                      <th className="py-2 pr-4">Symbol</th>
                      <th className="py-2 pr-4">Side</th>
                      <th className="py-2 pr-4">Opened</th>
                      <th className="py-2 pr-4">Closed</th>
                      <th className="py-2 pr-4">P/L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.trades
                      .filter((t) => filterSide === "ALL" || t.side === filterSide)
                      .filter((t) => !filterSymbol || t.symbol.toLowerCase().includes(filterSymbol.toLowerCase()))
                      .map((t) => (
                        <tr key={t.id} className="border-t border-white/5">
                          <td className="py-2 pr-4">{t.symbol}</td>
                          <td className="py-2 pr-4">{t.side}</td>
                          <td className="py-2 pr-4">{new Date(t.openedAt).toLocaleDateString()}</td>
                          <td className="py-2 pr-4">{t.closedAt ? new Date(t.closedAt).toLocaleDateString() : "Open"}</td>
                          <td className={`py-2 pr-4 ${t.pnlCents !== null && t.pnlCents < 0 ? "text-red-400" : "text-green-400"}`}>
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
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
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
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
      <div className="flex justify-between text-xs text-white/50">
        <span>{label}</span>
        <span className={breached ? "text-red-400" : ""}>{usedPct}% used</span>
      </div>
      <div className="mt-2 h-2 w-full rounded-full bg-white/10">
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
              i <= idx ? "bg-[var(--brand-primary)] text-white" : "bg-white/10 text-white/40"
            }`}
          >
            {p.replace("_", " ")}
          </div>
          {i < PHASES.length - 1 && <span className="text-white/20">→</span>}
        </div>
      ))}
    </div>
  );
}
