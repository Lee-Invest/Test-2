import Link from "next/link";
import { Target, TrendingDown, ShieldAlert, CalendarDays, Infinity as InfinityIcon, Percent } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES, type StaticTemplate as Template } from "@/lib/static-templates";

// Purely a display grid — every "Start Now" click hands off to the Buy
// Challenge page (/pricing), which owns the one real checkout flow
// (account-size selection, coupon, contract acceptance, and the actual
// /api/checkout call). Keeping checkout logic in a single place avoids two
// copies of the same fetch/error-handling code drifting apart.
export function ChallengeCards() {
  const templates = STATIC_TEMPLATES;
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

            <Link
              href={`/pricing?template=${t.id}`}
              style={{ backgroundColor: "#1d3557" }}
              className="mt-4 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-black/20 backdrop-blur-xl hover:opacity-90"
            >
              Start Now
            </Link>

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
