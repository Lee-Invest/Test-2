"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {templates.map((t) => (
        <div
          key={t.id}
          className="flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[var(--brand-primary)] hover:shadow-md"
        >
          <div className="text-center">
            <div className="text-xl font-bold text-gray-900">${t.accountSize.toLocaleString()}</div>
            <div className="text-xs text-gray-500">Account</div>
          </div>

          <div className="mt-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{formatCents(t.priceCents)}</div>
            <div className="text-xs text-gray-500">One-time evaluation fee</div>
          </div>

          <button
            onClick={() => startChallenge(t.id)}
            disabled={loadingId === t.id}
            className="mt-4 rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {loadingId === t.id ? "Starting…" : "Start Now"}
          </button>

          <dl className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-xs">
            <Row label="Phase 1 / 2 Target" value={`${t.phase1ProfitTargetPct}% / ${t.phase2ProfitTargetPct}%`} />
            <Row label="Max Daily Loss" value={`${t.maxDailyLossPct}%`} />
            <Row label="Max Total Loss" value={`${t.maxOverallLossPct}%`} />
            <Row label="Min Trading Days" value={`${t.phase1MinTradingDays} days`} />
            <Row label="Payout Split" value={`Up to ${t.profitSplitTraderPct}%`} />
          </dl>
        </div>
      ))}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-semibold text-gray-900">{value}</dd>
    </div>
  );
}
