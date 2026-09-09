"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/nav";
import { formatCents } from "@/lib/utils";

type Tab = "analytics" | "templates" | "accounts" | "payouts";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("analytics");

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
        <div className="mt-6 flex gap-2 border-b border-gray-200">
          {(["analytics", "templates", "accounts", "payouts"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                tab === t ? "border-b-2 border-[var(--brand-primary)] text-gray-900" : "text-gray-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="mt-8">
          {tab === "analytics" && <Analytics />}
          {tab === "templates" && <Templates />}
          {tab === "accounts" && <Accounts />}
          {tab === "payouts" && <Payouts />}
        </div>
      </main>
    </>
  );
}

function Analytics() {
  const [data, setData] = useState<{
    revenueCents: number;
    activeTraders: number;
    passRate: number;
    failRate: number;
    fundedCount: number;
  } | null>(null);

  useEffect(() => {
    fetch("/api/admin/analytics").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-gray-500">Loading…</p>;

  const cards = [
    { label: "Revenue", value: formatCents(data.revenueCents) },
    { label: "Active Traders", value: data.activeTraders.toString() },
    { label: "Pass Rate", value: `${data.passRate}%` },
    { label: "Fail Rate", value: `${data.failRate}%` },
    { label: "Funded Accounts", value: data.fundedCount.toString() },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-400">{c.label}</div>
          <div className="mt-1 text-xl font-bold text-gray-900">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

interface Template {
  id: string;
  name: string;
  accountSize: number;
  priceCents: number;
  active: boolean;
  phase1ProfitTargetPct: string;
  phase2ProfitTargetPct: string;
  maxDailyLossPct: string;
  maxOverallLossPct: string;
  phase1MinTradingDays: number;
  phase2MinTradingDays: number;
  profitSplitTraderPct: string;
  dailyResetTimeUtc: string;
}

function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  function load() {
    fetch("/api/admin/templates").then((r) => r.json()).then((d) => setTemplates(d.templates ?? []));
  }

  useEffect(load, []);

  async function save(t: Template) {
    setSaving(t.id);
    await fetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: t.id,
        name: t.name,
        accountSize: Number(t.accountSize),
        priceCents: Number(t.priceCents),
        active: t.active,
        phase1ProfitTargetPct: Number(t.phase1ProfitTargetPct),
        phase2ProfitTargetPct: Number(t.phase2ProfitTargetPct),
        maxDailyLossPct: Number(t.maxDailyLossPct),
        maxOverallLossPct: Number(t.maxOverallLossPct),
        phase1MinTradingDays: Number(t.phase1MinTradingDays),
        phase2MinTradingDays: Number(t.phase2MinTradingDays),
        profitSplitTraderPct: Number(t.profitSplitTraderPct),
        dailyResetTimeUtc: t.dailyResetTimeUtc,
      }),
    });
    setSaving(null);
    load();
  }

  function update(id: string, field: keyof Template, value: string | boolean) {
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));
  }

  return (
    <div className="space-y-6">
      {templates.map((t) => (
        <div key={t.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-900">${t.accountSize.toLocaleString()} — {t.name}</div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={t.active} onChange={(e) => update(t.id, "active", e.target.checked)} />
              Active
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Price (cents)" value={t.priceCents} onChange={(v) => update(t.id, "priceCents", v)} />
            <Field label="P1 Target %" value={t.phase1ProfitTargetPct} onChange={(v) => update(t.id, "phase1ProfitTargetPct", v)} />
            <Field label="P2 Target %" value={t.phase2ProfitTargetPct} onChange={(v) => update(t.id, "phase2ProfitTargetPct", v)} />
            <Field label="Max Daily Loss %" value={t.maxDailyLossPct} onChange={(v) => update(t.id, "maxDailyLossPct", v)} />
            <Field label="Max Overall Loss %" value={t.maxOverallLossPct} onChange={(v) => update(t.id, "maxOverallLossPct", v)} />
            <Field label="Min Days P1" value={t.phase1MinTradingDays} onChange={(v) => update(t.id, "phase1MinTradingDays", v)} />
            <Field label="Min Days P2" value={t.phase2MinTradingDays} onChange={(v) => update(t.id, "phase2MinTradingDays", v)} />
            <Field label="Profit Split %" value={t.profitSplitTraderPct} onChange={(v) => update(t.id, "profitSplitTraderPct", v)} />
          </div>
          <button
            onClick={() => save(t)}
            disabled={saving === t.id}
            className="mt-4 rounded-md bg-[var(--brand-primary)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving === t.id ? "Saving…" : "Save"}
          </button>
        </div>
      ))}
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string | number; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-gray-400">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
      />
    </div>
  );
}

interface AccountRow {
  id: string;
  userId: string;
  user: { email: string; name: string | null };
  template: { accountSize: number };
  currentBalanceCents: number;
  isActive: boolean;
  phases: { type: string; status: string }[];
}

function Accounts() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);

  function load() {
    fetch("/api/admin/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts ?? []));
  }
  useEffect(load, []);

  async function act(accountId: string, action: string) {
    await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, action }),
    });
    load();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-gray-400">
          <tr>
            <th className="py-2 pr-4">Trader</th>
            <th className="py-2 pr-4">Size</th>
            <th className="py-2 pr-4">Balance</th>
            <th className="py-2 pr-4">Phase</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t border-gray-100 text-gray-900">
              <td className="py-2 pr-4">{a.user.name ?? a.user.email}</td>
              <td className="py-2 pr-4">${a.template.accountSize.toLocaleString()}</td>
              <td className="py-2 pr-4">{formatCents(a.currentBalanceCents)}</td>
              <td className="py-2 pr-4">{a.phases[0]?.type ?? "—"}</td>
              <td className="py-2 pr-4">{a.isActive ? "Active" : "Suspended"}</td>
              <td className="py-2 pr-4 space-x-2">
                <ActionButton onClick={() => act(a.id, "SUSPEND")}>Suspend</ActionButton>
                <ActionButton onClick={() => act(a.id, "REACTIVATE")}>Reactivate</ActionButton>
                <ActionButton onClick={() => act(a.id, "RESET")}>Reset</ActionButton>
                <ActionButton onClick={() => act(a.id, "MARK_FUNDED")}>Mark Funded</ActionButton>
                <ActionButton onClick={() => act(a.id, "CLOSE")}>Close</ActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50">
      {children}
    </button>
  );
}

interface PayoutRow {
  id: string;
  amountCents: number;
  status: string;
  account: { user: { email: string; name: string | null } };
}

function Payouts() {
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);

  function load() {
    fetch("/api/admin/payouts").then((r) => r.json()).then((d) => setPayouts(d.payouts ?? []));
  }
  useEffect(load, []);

  async function act(payoutId: string, action: string) {
    await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutId, action }),
    });
    load();
  }

  if (payouts.length === 0) return <p className="text-gray-500">No payout requests yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-gray-400">
          <tr>
            <th className="py-2 pr-4">Trader</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id} className="border-t border-gray-100 text-gray-900">
              <td className="py-2 pr-4">{p.account.user.name ?? p.account.user.email}</td>
              <td className="py-2 pr-4">{formatCents(p.amountCents)}</td>
              <td className="py-2 pr-4">{p.status}</td>
              <td className="py-2 pr-4 space-x-2">
                <ActionButton onClick={() => act(p.id, "APPROVE")}>Approve</ActionButton>
                <ActionButton onClick={() => act(p.id, "REJECT")}>Reject</ActionButton>
                <ActionButton onClick={() => act(p.id, "MARK_PAID")}>Mark Paid</ActionButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
