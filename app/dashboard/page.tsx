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
  isFunded: boolean;
  profitSplitTraderPct: number;
  availablePayoutCents: number;
  isFailed: boolean;
  breachEvent: { message: string; createdAt: string } | null;
}

interface Payout {
  id: string;
  amountCents: number;
  traderShareCents: number;
  firmShareCents: number;
  status: string;
  requestedAt: string;
  processedAt: string | null;
  account: { id: string; template: { accountSize: number } };
}

const PHASES = ["PHASE_1", "PHASE_2", "FUNDED"];

const PAYOUT_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  REJECTED: "bg-red-100 text-red-800",
  PAID: "bg-green-100 text-green-800",
};

export default function DashboardPage() {
  const [tab, setTab] = useState<"overview" | "payouts">("overview");
  const [accounts, setAccounts] = useState<AccountView[] | null>(null);
  const [payouts, setPayouts] = useState<Payout[] | null>(null);
  const [filterSide, setFilterSide] = useState<string>("ALL");
  const [filterSymbol, setFilterSymbol] = useState<string>("");
  const [requesting, setRequesting] = useState<string | null>(null);
  const [payoutMessage, setPayoutMessage] = useState<string | null>(null);

  function loadDashboard() {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts ?? []));
  }

  function loadPayouts() {
    fetch("/api/payouts")
      .then((r) => r.json())
      .then((d) => setPayouts(d.payouts ?? []));
  }

  useEffect(() => {
    loadDashboard();
    loadPayouts();
  }, []);

  async function requestPayout(accountId: string) {
    setRequesting(accountId);
    setPayoutMessage(null);
    try {
      const res = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPayoutMessage(data.error ?? "Payout request failed.");
        return;
      }
      setPayoutMessage("Payout requested successfully.");
      loadPayouts();
    } finally {
      setRequesting(null);
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Trader Dashboard</h1>

        <div className="mt-6 flex gap-2 border-b border-gray-200">
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={tab === "payouts"} onClick={() => setTab("payouts")}>
            Payouts
          </TabButton>
        </div>

        {tab === "overview" && (
          <>
            {accounts === null && <p className="mt-8 text-gray-500">Loading…</p>}
            {accounts?.length === 0 && (
              <p className="mt-8 text-gray-500">
                You don&apos;t have any challenge accounts yet.{" "}
                <a href="/pricing" className="text-[var(--brand-accent)]">
                  Start a challenge
                </a>
                .
              </p>
            )}

            {accounts?.map((account) => (
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
                      {account.breachEvent?.message ??
                        "This account breached a risk rule and is no longer active."}
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
                        <span className="text-sm font-normal text-green-700">
                          ({account.profitSplitTraderPct}% split)
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => requestPayout(account.id)}
                      disabled={requesting === account.id || account.availablePayoutCents <= 0}
                      className="rounded-md bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {requesting === account.id ? "Requesting…" : "Request Payout"}
                    </button>
                  </div>
                )}

                <div className="mt-8">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-semibold text-gray-900">Trade History</h3>
                    <div className="flex gap-2">
                      <input
                        placeholder="Filter symbol…"
                        value={filterSymbol}
                        onChange={(e) => setFilterSymbol(e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                      />
                      <select
                        value={filterSide}
                        onChange={(e) => setFilterSide(e.target.value)}
                        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
                      >
                        <option value="ALL">All sides</option>
                        <option value="LONG">Long</option>
                        <option value="SHORT">Short</option>
                      </select>
                    </div>
                  </div>
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
                        {account.trades
                          .filter((t) => filterSide === "ALL" || t.side === filterSide)
                          .filter((t) => !filterSymbol || t.symbol.toLowerCase().includes(filterSymbol.toLowerCase()))
                          .map((t) => (
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
          </>
        )}

        {tab === "payouts" && (
          <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Payout History</h2>
            {payoutMessage && <p className="mt-2 text-sm text-gray-600">{payoutMessage}</p>}

            {payouts === null && <p className="mt-4 text-gray-500">Loading…</p>}
            {payouts?.length === 0 && (
              <p className="mt-4 text-gray-500">
                No payouts yet. Once an account reaches Funded status, you can request a payout from the Overview
                tab.
              </p>
            )}

            {payouts && payouts.length > 0 && (
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
        )}
      </main>
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
        active ? "border-[var(--brand-primary)] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
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
