import Link from "next/link";
import { Target, TrendingDown, ShieldAlert, CalendarDays, Infinity as InfinityIcon, Percent } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES, type StaticTemplate as Template } from "@/lib/static-templates";
import { RuleTooltip } from "@/components/rule-tooltip";

// Purely a display grid — every "Start Now" click hands off to the Buy
// Challenge page (/pricing), which owns the one real checkout flow
// (account-size selection, coupon, contract acceptance, and the actual
// /api/checkout call). Keeping checkout logic in a single place avoids two
// copies of the same fetch/error-handling code drifting apart.
const GOLD = "#b48c46";

export function ChallengeCards() {
  const templates = STATIC_TEMPLATES;
  const uniqueSizes = [25_000, 50_000];

  const lossAmount = (t: Template, pct: string) => formatCents(Math.round(t.accountSize * 100 * (Number(pct) / 100)));

  const floorAfter = (t: Template, pct: string) =>
    formatCents(t.accountSize * 100 - Math.round(t.accountSize * 100 * (Number(pct) / 100)));

  const rows: {
    icon: React.ElementType;
    label: string;
    explain: (t: Template) => string;
    render: (t: Template) => React.ReactNode;
  }[] = [
    {
      icon: Target,
      label: "Phase 1 Target",
      explain: (t) => `Grow your account balance by ${t.phase1ProfitTargetPct}% during Phase 1 to move on to Phase 2.`,
      render: (t) => <span className="font-semibold text-gray-900">{t.phase1ProfitTargetPct}%</span>,
    },
    {
      icon: Target,
      label: "Phase 2 Target",
      explain: (t) => `Hit a second, smaller ${t.phase2ProfitTargetPct}% target in Phase 2 to get funded.`,
      render: (t) => <span className="font-semibold text-gray-900">{t.phase2ProfitTargetPct}%</span>,
    },
    {
      icon: TrendingDown,
      label: "Max Daily Loss",
      explain: (t) =>
        `Your equity can't drop more than ${t.maxDailyLossPct}% (${lossAmount(t, t.maxDailyLossPct)}) below where it started that trading day, or the account fails.`,
      render: (t) => (
        <span className="font-semibold text-gray-900">
          {t.maxDailyLossPct}% ({lossAmount(t, t.maxDailyLossPct)})
        </span>
      ),
    },
    {
      icon: ShieldAlert,
      label: "Max Total Loss",
      explain: (t) =>
        `Your balance can never fall more than ${t.maxOverallLossPct}% (${lossAmount(t, t.maxOverallLossPct)}) below the starting $${t.accountSize.toLocaleString()} — so it must always stay above ${floorAfter(t, t.maxOverallLossPct)}.`,
      render: (t) => (
        <span className="font-semibold text-gray-900">
          {t.maxOverallLossPct}% ({lossAmount(t, t.maxOverallLossPct)})
        </span>
      ),
    },
    {
      icon: CalendarDays,
      label: "Min Trading Days",
      explain: (t) => `You must place at least one trade on ${t.phase1MinTradingDays} separate days in each phase.`,
      render: (t) => <span className="font-semibold text-gray-900">{t.phase1MinTradingDays} days</span>,
    },
    {
      icon: InfinityIcon,
      label: "Trading Period",
      explain: () => "No time limit on either phase — trade at your own pace.",
      render: () => <span className="font-semibold text-gray-900">Unlimited</span>,
    },
    {
      icon: Percent,
      label: "Payout Split",
      explain: (t) => `Once funded, you keep ${t.profitSplitTraderPct}% of the profits you withdraw.`,
      render: (t) => <span className="font-semibold text-[var(--brand-accent)]">{t.profitSplitTraderPct}%</span>,
    },
  ];

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
      {templates.map((t) => {
        const estCents = Math.round(
          t.accountSize * 100 * (Number(t.phase1ProfitTargetPct) / 100) * (Number(t.profitSplitTraderPct) / 100)
        );
        const isGold = t.accountSize === 200_000;
        const isUnique = uniqueSizes.includes(t.accountSize);
        return (
          <div
            key={t.id}
            className="relative flex flex-col rounded-2xl border bg-white/15 p-5 pt-7 shadow-[0_8px_32px_rgba(31,38,135,0.1)] backdrop-blur-2xl transition hover:bg-white/30"
            style={{ borderColor: isGold ? GOLD : "rgba(255,255,255,0.4)", borderWidth: isGold ? 2 : 1 }}
          >
            {isUnique && (
              <div
                className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                style={{ backgroundColor: GOLD }}
              >
                Unique
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
                <div key={row.label} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <dt className="flex min-w-0 items-center gap-1.5 text-gray-500">
                    <row.icon size={13} className="shrink-0 text-gray-400" />
                    <RuleTooltip text={row.explain(t)}>
                      <span>{row.label}</span>
                    </RuleTooltip>
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
