"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Target, TrendingDown, ShieldAlert, CalendarDays, Infinity as InfinityIcon, Percent } from "lucide-react";
import { formatCents } from "@/lib/utils";

interface Template {
  id: string;
  name: string;
  accountSize: number;
  priceCents: number;
  phase1ProfitTargetPct: string;
  phase2ProfitTargetPct: string;
  maxDailyLossPct: string;
  maxOverallLossPct: string;
  phase1MinTradingDays: number;
  profitSplitTraderPct: string;
}

export function ChallengeCards() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []));
  }, []);

  async function startChallenge(templateId: string) {
    if (!session) {
      router.push("/login?next=/pricing");
      return;
    }
    setLoadingId(templateId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoadingId(null);
    }
  }

  if (templates === null) {
    return <p className="text-center text-gray-500">Loading challenges…</p>;
  }

  const popularIdx = templates.findIndex((t) => t.accountSize === 100_000);
  const gridCols = `minmax(160px,200px) repeat(${templates.length}, minmax(0, 1fr))`;

  const rows: { icon: React.ElementType; label: string; render: (t: Template) => React.ReactNode }[] = [
    {
      icon: Target,
      label: "Phase 1 Profit Target",
      render: (t) => <span className="font-semibold text-white">{t.phase1ProfitTargetPct} percent</span>,
    },
    {
      icon: Target,
      label: "Phase 2 Profit Target",
      render: (t) => <span className="font-semibold text-white">{t.phase2ProfitTargetPct} percent</span>,
    },
    {
      icon: TrendingDown,
      label: "Maximum Daily Loss",
      render: (t) => <span className="font-semibold text-white">{t.maxDailyLossPct} percent</span>,
    },
    {
      icon: ShieldAlert,
      label: "Maximum Total Loss",
      render: (t) => <span className="font-semibold text-white">{t.maxOverallLossPct} percent</span>,
    },
    {
      icon: CalendarDays,
      label: "Minimum Trading Days",
      render: (t) => <span className="font-semibold text-white">{t.phase1MinTradingDays} days</span>,
    },
    {
      icon: InfinityIcon,
      label: "Trading Period",
      render: () => <span className="font-semibold text-white">Unlimited</span>,
    },
    {
      icon: Percent,
      label: "Payout Split",
      render: (t) => <span className="font-semibold text-[var(--brand-accent)]">Up to {t.profitSplitTraderPct} percent</span>,
    },
  ];

  return (
    <div className="rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 p-4 sm:p-8">
      {/* Desktop: one shared grid, each metric its own frosted-glass bar */}
      <div className="hidden lg:block">
        {/* Header bar: account sizes */}
        <div
          className="grid items-center gap-x-4 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-5 backdrop-blur-xl"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="text-sm font-semibold text-gray-300">Account Size</div>
          {templates.map((t, i) => (
            <div key={t.id} className="relative text-center">
              {i === popularIdx && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Best Value
                </div>
              )}
              <div className="text-2xl font-bold text-white">${t.accountSize.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Metric bars */}
        <div className="mt-3 space-y-3">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid items-center gap-x-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 backdrop-blur-xl"
              style={{ gridTemplateColumns: gridCols }}
            >
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <row.icon size={16} className="shrink-0 text-gray-400" />
                <span>{row.label}</span>
              </div>
              {templates.map((t) => (
                <div key={t.id} className="text-center text-sm">
                  {row.render(t)}
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Price + CTA bar */}
        <div
          className="mt-3 grid items-center gap-x-4 rounded-2xl border border-white/10 bg-white/[0.07] px-4 py-5 backdrop-blur-xl"
          style={{ gridTemplateColumns: gridCols }}
        >
          <div className="text-sm text-gray-300">One-Time Evaluation Fee</div>
          {templates.map((t) => (
            <div key={t.id} className="flex flex-col items-center gap-3">
              <div className="text-xl font-bold text-white">{formatCents(t.priceCents)}</div>
              <button
                onClick={() => startChallenge(t.id)}
                disabled={loadingId === t.id}
                className="w-full rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--brand-primary)]/20 hover:opacity-90 disabled:opacity-50"
              >
                {loadingId === t.id ? "Starting…" : "Start Now"}
              </button>
            </div>
          ))}
        </div>

        {/* Estimated reward bar */}
        <div className="mt-3 grid items-center gap-x-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3" style={{ gridTemplateColumns: gridCols }}>
          <div className="text-xs text-gray-400">Estimated First Payout</div>
          {templates.map((t) => {
            const estCents = Math.round(
              t.accountSize * 100 * (Number(t.phase1ProfitTargetPct) / 100) * (Number(t.profitSplitTraderPct) / 100)
            );
            return (
              <div key={t.id} className="text-center text-xs font-semibold text-gray-200">
                {formatCents(estCents)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: stacked glass cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {templates.map((t, i) => (
          <div
            key={t.id}
            className={`rounded-2xl border p-5 backdrop-blur-xl ${
              i === popularIdx ? "border-[var(--brand-primary)]/50 bg-white/[0.08]" : "border-white/10 bg-white/[0.05]"
            }`}
          >
            <div className="text-center">
              <div className="text-xs uppercase tracking-wide text-gray-400">Account Size</div>
              <div className="text-xl font-bold text-white">${t.accountSize.toLocaleString()}</div>
            </div>
            <div className="mt-3 text-center text-xl font-bold text-white">{formatCents(t.priceCents)}</div>
            <button
              onClick={() => startChallenge(t.id)}
              disabled={loadingId === t.id}
              className="mt-3 w-full rounded-xl bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loadingId === t.id ? "Starting…" : "Start Now"}
            </button>
            <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-gray-400">
                    <row.icon size={13} className="shrink-0" />
                    {row.label}
                  </dt>
                  <dd>{row.render(t)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
