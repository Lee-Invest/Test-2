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
  const cols = templates.length;

  const gridCols = `minmax(140px,180px) repeat(${cols}, minmax(0, 1fr))`;

  return (
    <div className="rounded-2xl bg-gray-900 p-4 sm:p-8">
      {/* Desktop: one shared grid so label rows and card rows are always pixel-aligned */}
      <div className="hidden overflow-x-auto lg:block">
        <div className="grid gap-x-4 gap-y-0" style={{ gridTemplateColumns: gridCols }}>
          {/* Header row: account sizes */}
          <div />
          {templates.map((t, i) => (
            <div key={t.id} className={`relative rounded-t-xl px-4 pt-6 text-center ${i === popularIdx ? "bg-white/10" : ""}`}>
              {i === popularIdx && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Best Value
                </div>
              )}
              <div className="text-xs uppercase tracking-wide text-gray-400">Account</div>
              <div className="text-2xl font-bold text-white">${t.accountSize.toLocaleString()}</div>
            </div>
          ))}

          <GridRow icon={Target} label="Profit Target">
            {templates.map((t) => (
              <span key={t.id} className="text-xs text-gray-200">
                <span className="text-gray-400">P1</span> {t.phase1ProfitTargetPct}%{" "}
                <span className="text-gray-400">P2</span> {t.phase2ProfitTargetPct}%
              </span>
            ))}
          </GridRow>

          <GridRow icon={TrendingDown} label="Max Daily Loss">
            {templates.map((t) => (
              <span key={t.id} className="font-semibold text-gray-200">
                {t.maxDailyLossPct}%
              </span>
            ))}
          </GridRow>

          <GridRow icon={ShieldAlert} label="Max Total Loss">
            {templates.map((t) => (
              <span key={t.id} className="font-semibold text-gray-200">
                {t.maxOverallLossPct}%
              </span>
            ))}
          </GridRow>

          <GridRow icon={CalendarDays} label="Min Trading Days">
            {templates.map((t) => (
              <span key={t.id} className="font-semibold text-gray-200">
                {t.phase1MinTradingDays} days
              </span>
            ))}
          </GridRow>

          <GridRow icon={InfinityIcon} label="Trading Period">
            {templates.map((t) => (
              <span key={t.id} className="font-semibold text-gray-200">
                Unlimited
              </span>
            ))}
          </GridRow>

          <GridRow icon={Percent} label="Payout Split">
            {templates.map((t) => (
              <span key={t.id} className="font-semibold text-[var(--brand-accent)]">
                Up to {t.profitSplitTraderPct}%
              </span>
            ))}
          </GridRow>

          {/* Divider */}
          <div className="border-t border-white/10 py-1" />
          {templates.map((t) => (
            <div key={t.id} className="border-t border-white/10 py-1" />
          ))}

          {/* Price row */}
          <div className="flex items-center pr-2 text-xs text-gray-400">One-time evaluation fee</div>
          {templates.map((t) => (
            <div key={t.id} className="pb-2 text-center">
              <div className="text-xl font-bold text-white">{formatCents(t.priceCents)}</div>
            </div>
          ))}

          {/* Button row */}
          <div />
          {templates.map((t) => (
            <div key={t.id} className={`rounded-b-xl px-3 pb-6 ${t.accountSize === 100_000 ? "bg-white/10" : ""}`}>
              <button
                onClick={() => startChallenge(t.id)}
                disabled={loadingId === t.id}
                className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loadingId === t.id ? "Starting…" : "Start Now"}
              </button>
            </div>
          ))}
        </div>

        {/* Avg reward pills */}
        <div className="mt-6 grid gap-x-4" style={{ gridTemplateColumns: gridCols }}>
          <div />
          {templates.map((t) => {
            const estCents = Math.round(
              t.accountSize * 100 * (Number(t.phase1ProfitTargetPct) / 100) * (Number(t.profitSplitTraderPct) / 100)
            );
            return (
              <div key={t.id} className="rounded-lg bg-white/5 py-2 text-center text-xs text-gray-300">
                <span className="font-semibold text-white">{formatCents(estCents)}</span> Est. Reward
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {templates.map((t, i) => (
          <div
            key={t.id}
            className={`rounded-xl p-5 ${i === popularIdx ? "bg-white/10 ring-1 ring-[var(--brand-primary)]" : "bg-white/5"}`}
          >
            <div className="text-center">
              <div className="text-xs uppercase tracking-wide text-gray-400">Account</div>
              <div className="text-xl font-bold text-white">${t.accountSize.toLocaleString()}</div>
            </div>
            <div className="mt-3 text-center text-xl font-bold text-white">{formatCents(t.priceCents)}</div>
            <button
              onClick={() => startChallenge(t.id)}
              disabled={loadingId === t.id}
              className="mt-3 w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loadingId === t.id ? "Starting…" : "Start Now"}
            </button>
            <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
              <MobileRow label="P1 / P2 Target" value={`${t.phase1ProfitTargetPct}% / ${t.phase2ProfitTargetPct}%`} />
              <MobileRow label="Max Daily Loss" value={`${t.maxDailyLossPct}%`} />
              <MobileRow label="Max Total Loss" value={`${t.maxOverallLossPct}%`} />
              <MobileRow label="Min Trading Days" value={`${t.phase1MinTradingDays} days`} />
              <MobileRow label="Payout Split" value={`Up to ${t.profitSplitTraderPct}%`} />
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}

function GridRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="flex items-center gap-2 py-2.5 text-xs text-gray-300">
        <Icon size={14} className="shrink-0 text-gray-500" />
        <span className="border-b border-dotted border-gray-600">{label}</span>
      </div>
      {children instanceof Array
        ? children.map((child, i) => (
            <div key={i} className="flex items-center justify-center py-2.5 text-center">
              {child}
            </div>
          ))
        : children}
    </>
  );
}

function MobileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-400">{label}</dt>
      <dd className="font-semibold text-white">{value}</dd>
    </div>
  );
}
