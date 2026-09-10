"use client";

import { useState } from "react";
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

// Static display data matching the default seeded ChallengeTemplate rows
// (see prisma/seed.ts) — the pricing page shown here no longer waits on a
// fetch to /api/templates, so it never gets stuck on a loading state.
// Checkout still hits the real /api/checkout route with this id, which
// validates and prices the order server-side from the database; if an
// admin changes a template's price or rules, update the values below to
// match so the marketing display and the real checkout stay in sync.
const TEMPLATES: Template[] = [
  {
    id: "seed-10000",
    name: "$10,000 Challenge",
    accountSize: 10_000,
    priceCents: 8_700,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
  {
    id: "seed-25000",
    name: "$25,000 Challenge",
    accountSize: 25_000,
    priceCents: 13_800,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
  {
    id: "seed-50000",
    name: "$50,000 Challenge",
    accountSize: 50_000,
    priceCents: 31_000,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
  {
    id: "seed-100000",
    name: "$100,000 Challenge",
    accountSize: 100_000,
    priceCents: 51_800,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
  {
    id: "seed-200000",
    name: "$200,000 Challenge",
    accountSize: 200_000,
    priceCents: 102_800,
    phase1ProfitTargetPct: "10",
    phase2ProfitTargetPct: "5",
    maxDailyLossPct: "5",
    maxOverallLossPct: "10",
    phase1MinTradingDays: 4,
    profitSplitTraderPct: "80",
  },
];

export function ChallengeCards() {
  const templates = TEMPLATES;
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

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

  const popularIdx = templates.findIndex((t) => t.accountSize === 100_000);

  const rows: { icon: React.ElementType; label: string; render: (t: Template) => React.ReactNode }[] = [
    {
      icon: Target,
      label: "Phase 1 Profit Target",
      render: (t) => <span className="font-semibold text-gray-900">{t.phase1ProfitTargetPct} percent</span>,
    },
    {
      icon: Target,
      label: "Phase 2 Profit Target",
      render: (t) => <span className="font-semibold text-gray-900">{t.phase2ProfitTargetPct} percent</span>,
    },
    {
      icon: TrendingDown,
      label: "Maximum Daily Loss",
      render: (t) => <span className="font-semibold text-gray-900">{t.maxDailyLossPct} percent</span>,
    },
    {
      icon: ShieldAlert,
      label: "Maximum Total Loss",
      render: (t) => <span className="font-semibold text-gray-900">{t.maxOverallLossPct} percent</span>,
    },
    {
      icon: CalendarDays,
      label: "Minimum Trading Days",
      render: (t) => <span className="font-semibold text-gray-900">{t.phase1MinTradingDays} days</span>,
    },
    {
      icon: InfinityIcon,
      label: "Trading Period",
      render: () => <span className="font-semibold text-gray-900">Unlimited</span>,
    },
    {
      icon: Percent,
      label: "Payout Split",
      render: (t) => <span className="font-semibold text-[var(--brand-accent)]">Up to {t.profitSplitTraderPct} percent</span>,
    },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
      {templates.map((t, i) => {
        const estCents = Math.round(
          t.accountSize * 100 * (Number(t.phase1ProfitTargetPct) / 100) * (Number(t.profitSplitTraderPct) / 100)
        );
        return (
          <div
            key={t.id}
            className={`relative flex flex-col rounded-2xl border p-5 pt-7 shadow-[0_8px_32px_rgba(31,38,135,0.1)] backdrop-blur-2xl transition hover:bg-white/30 ${
              i === popularIdx ? "border-[var(--brand-primary)]/40 bg-white/25" : "border-white/40 bg-white/15"
            }`}
          >
            {i === popularIdx && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                Best Value
              </div>
            )}

            <div className="text-center">
              <div className="text-xs uppercase tracking-wide text-gray-500">Account Size</div>
              <div className="text-xl font-bold text-gray-900">${t.accountSize.toLocaleString()}</div>
            </div>

            <div className="mt-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{formatCents(t.priceCents)}</div>
              <div className="text-xs text-gray-500">One-Time Evaluation Fee</div>
            </div>

            <button
              onClick={() => startChallenge(t.id)}
              disabled={loadingId === t.id}
              className="mt-4 rounded-xl bg-[var(--brand-primary)]/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[var(--brand-primary)]/20 backdrop-blur-xl hover:opacity-90 disabled:opacity-50"
            >
              {loadingId === t.id ? "Starting…" : "Start Now"}
            </button>

            <div className="mt-3 text-center text-xs text-gray-500">
              Estimated First Payout{" "}
              <span className="font-semibold text-[var(--brand-accent)]">{formatCents(estCents)}</span>
            </div>

            <dl className="mt-5 space-y-3 border-t border-white/40 pt-4 text-xs">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-2">
                  <dt className="flex min-w-0 items-center gap-1.5 text-gray-500">
                    <row.icon size={13} className="shrink-0 text-gray-400" />
                    <span className="truncate">{row.label}</span>
                  </dt>
                  <dd className="shrink-0">{row.render(t)}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
