"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Target, TrendingDown, ShieldAlert, CalendarDays, Percent } from "lucide-react";
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

interface Promo {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
}

function discountedPriceCents(priceCents: number, promo: Promo | null): number {
  if (!promo) return priceCents;
  if (promo.type === "PERCENT") return Math.round(priceCents * (1 - promo.value / 100));
  return Math.max(0, priceCents - Math.round(promo.value));
}

export function ChallengeCards() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [promo, setPromo] = useState<Promo | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates ?? []));
    fetch("/api/promo")
      .then((r) => r.json())
      .then((data) => setPromo(data.promo ?? null));
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
        body: JSON.stringify({ templateId, couponCode: promo?.code }),
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

  return (
    <div>
      {promo && (
        <div className="mb-8 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--brand-primary)]">
          <span>
            🎉 {promo.type === "PERCENT" ? `${promo.value}% off` : `${formatCents(promo.value)} off`} every
            challenge —
          </span>
          <code className="rounded bg-white px-2 py-0.5 font-mono text-xs font-semibold shadow-sm">{promo.code}</code>
          <span>applied automatically at checkout.</span>
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {templates.map((t, i) => {
          const discounted = discountedPriceCents(t.priceCents, promo);
          const hasDiscount = discounted < t.priceCents;
          const estFirstPayoutCents = Math.round(
            t.accountSize * 100 * (Number(t.phase1ProfitTargetPct) / 100) * (Number(t.profitSplitTraderPct) / 100)
          );

          return (
            <div
              key={t.id}
              className={`relative flex flex-col rounded-xl border bg-white p-5 pt-7 shadow-sm transition hover:shadow-md ${
                i === popularIdx ? "border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]" : "border-gray-200"
              }`}
            >
              {i === popularIdx && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
                  Most Popular
                </div>
              )}

              <div className="text-center">
                <div className="text-xl font-bold text-gray-900">${t.accountSize.toLocaleString()}</div>
                <div className="text-xs text-gray-500">Account</div>
              </div>

              <div className="mt-4 text-center">
                {hasDiscount && <div className="text-xs text-gray-400 line-through">{formatCents(t.priceCents)}</div>}
                <div className="text-2xl font-bold text-gray-900">{formatCents(discounted)}</div>
                <div className="text-xs text-gray-500">One-time evaluation fee</div>
              </div>

              <button
                onClick={() => startChallenge(t.id)}
                disabled={loadingId === t.id}
                className="mt-4 rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loadingId === t.id ? "Starting…" : "Start Now"}
              </button>

              <div className="mt-3 text-center text-xs text-gray-400">
                Est. first payout{" "}
                <span className="font-semibold text-[var(--brand-accent)]">{formatCents(estFirstPayoutCents)}</span>
              </div>

              <dl className="mt-5 space-y-3 border-t border-gray-100 pt-4">
                <Row icon={Target} label="P1 / P2 Target" value={`${t.phase1ProfitTargetPct}% / ${t.phase2ProfitTargetPct}%`} />
                <Row icon={TrendingDown} label="Max Daily Loss" value={`${t.maxDailyLossPct}%`} />
                <Row icon={ShieldAlert} label="Max Total Loss" value={`${t.maxOverallLossPct}%`} />
                <Row icon={CalendarDays} label="Min Trading Days" value={`${t.phase1MinTradingDays} days`} />
                <Row icon={Percent} label="Payout Split" value={`Up to ${t.profitSplitTraderPct}%`} />
              </dl>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-gray-200 pt-8 text-sm text-gray-600">
        <PlanInclude label="Transparent, configurable rules" />
        <PlanInclude label="Server-verified risk engine" />
        <PlanInclude label="Same-day evaluation start" />
        <PlanInclude label="No hidden fees" />
      </div>
    </div>
  );
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <dt className="flex min-w-0 items-center gap-1.5 text-gray-500">
        <Icon size={13} className="shrink-0 text-gray-400" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="shrink-0 font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

function PlanInclude({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--brand-accent)]/15 text-[var(--brand-accent)]">
        ✓
      </span>
      {label}
    </span>
  );
}
