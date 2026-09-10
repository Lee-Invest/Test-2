"use client";

import { Suspense, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES, type StaticTemplate } from "@/lib/static-templates";

const roadmap = [
  {
    icon: TrendingUp,
    title: "Phase 1 — Challenge",
    body: "Hit the profit target while staying inside the daily and overall loss limits, over as many trading days as you need.",
  },
  {
    icon: ShieldCheck,
    title: "Phase 2 — Verification",
    body: "A second, smaller profit target confirms your process was repeatable, not a one-off run.",
  },
  {
    icon: Wallet,
    title: "Funded & Paid",
    body: "Trade a funded account and request payouts once you're eligible — you keep your profit split of every withdrawal.",
  },
];

function BuyChallengeForm() {
  const templates = STATIC_TEMPLATES;
  const searchParams = useSearchParams();
  const preselected = searchParams.get("template");

  const [selectedId, setSelectedId] = useState<string | null>(
    (preselected && templates.some((t) => t.id === preselected) ? preselected : null) ??
      templates[Math.floor(templates.length / 2)]?.id ??
      null
  );
  const [couponCode, setCouponCode] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (preselected && templates.some((t) => t.id === preselected)) {
      setSelectedId(preselected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselected]);

  const selected = templates.find((t) => t.id === selectedId);

  async function startCheckout() {
    if (!selected) return;
    if (!agreed) {
      setMessage("Please confirm you've read and agree to the Funded Trader Agreement first.");
      return;
    }
    if (!session) {
      router.push("/login?next=/pricing");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selected.id,
          couponCode: couponCode || undefined,
          agreedToRules: true,
        }),
      });
      const data = await res.json().catch(() => null);
      if (data?.url) {
        window.location.href = data.url;
        return;
      } else if (data?.orderId) {
        setMessage(`Order ${data.orderId} created. ${data.error ?? ""}`.trim());
      } else if (typeof data?.error === "string") {
        setMessage(data.error);
      } else if (!res.ok) {
        setMessage(`Something went wrong (${res.status}). Please try again.`);
      } else {
        setMessage("Something went wrong. Please try again.");
      }
    } catch {
      setMessage("Could not reach the server. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-accent)]">Get Funded</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Buy a Challenge</h1>
        <p className="mt-3 text-gray-600">
          All account sizes share the same rule structure across two evaluation phases before funding. Pick a size,
          confirm you agree to the trading rules, then complete payment — every price and rule shown here is
          re-verified server-side at checkout.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/40 bg-white/25 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-gray-600 backdrop-blur-xl">
        <span>Two-Phase Evaluation</span>
        <span className="text-gray-300">•</span>
        <span>Server-Verified Risk Engine</span>
        <span className="text-gray-300">•</span>
        <span>Transparent Pricing</span>
        <span className="text-gray-300">•</span>
        <span>Up to 80% Profit Split</span>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {templates.map((t) => (
          <SizeCard key={t.id} template={t} selected={selectedId === t.id} onSelect={() => setSelectedId(t.id)} />
        ))}
      </div>

      {selected && (
        <div className="mt-10 grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <RuleCard label="Account Size" value={`$${selected.accountSize.toLocaleString()}`} />
              <RuleCard label="Price" value={formatCents(selected.priceCents)} />
              <RuleCard label="Phase 1 Profit Target" value={`${selected.phase1ProfitTargetPct}%`} />
              <RuleCard label="Phase 2 Profit Target" value={`${selected.phase2ProfitTargetPct}%`} />
              <RuleCard label="Max Daily Loss" value={`${selected.maxDailyLossPct}%`} />
              <RuleCard label="Max Overall Loss" value={`${selected.maxOverallLossPct}%`} />
              <RuleCard label="Min Trading Days (P1 / P2)" value={`${selected.phase1MinTradingDays} / ${selected.phase2MinTradingDays}`} />
              <RuleCard label="Funded Profit Split" value={`${selected.profitSplitTraderPct}% to you`} />
            </div>

            <div className="mt-8 rounded-2xl border border-white/40 bg-white/20 p-6 backdrop-blur-xl">
              <h2 className="text-lg font-bold text-gray-900">What happens after you pass</h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-3">
                {roadmap.map((step, i) => (
                  <div key={step.title} className="flex flex-col gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                      <step.icon size={18} />
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {i + 1}. {step.title}
                    </div>
                    <p className="text-xs text-gray-600">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/40 bg-white/25 p-6 shadow-[0_8px_32px_rgba(31,38,135,0.08)] backdrop-blur-2xl">
            <div className="text-sm text-gray-600">One-time evaluation fee</div>
            <div className="mt-1 text-3xl font-bold text-gray-900">{formatCents(selected.priceCents)}</div>

            <label className="mt-6 block text-xs text-gray-500">Coupon code (optional)</label>
            <input
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value)}
              placeholder="e.g. WELCOME10"
              className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
            />

            <div className="mt-6 max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white/70 p-3 text-xs text-gray-600">
              By purchasing, you agree to trade this evaluation account in good faith, respect the daily and overall
              loss limits shown above at all times, avoid prohibited strategies (account copying between challenges,
              latency arbitrage, and abuse of platform errors), and accept that breaching a risk rule ends the
              evaluation. This is the ApexFund Funded Trader Agreement and Trading Rules for this account size — the
              full text is available on the <a href="/rules" className="underline">Trading Rules</a> page.
            </div>

            <label className="mt-3 flex items-start gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span>I have read and agree to the Funded Trader Agreement and Trading Rules for this account size.</span>
            </label>

            <button
              type="button"
              onClick={startCheckout}
              disabled={loading || !agreed}
              style={{ backgroundColor: "#1d3557" }}
              className="mt-6 w-full rounded-md px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Starting checkout…" : "Buy Challenge"}
            </button>
            {message && <p className="mt-3 text-xs text-gray-600">{message}</p>}
          </div>
        </div>
      )}
    </>
  );
}

function SizeCard({
  template,
  selected,
  onSelect,
}: {
  template: StaticTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`relative flex flex-col items-center gap-1 rounded-2xl border-2 px-4 py-5 text-center transition ${
        selected
          ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {selected && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white">
          <Check size={12} />
        </div>
      )}
      <div className="text-lg font-bold text-gray-900">${template.accountSize.toLocaleString()}</div>
      <div className="text-xs text-gray-500">{formatCents(template.priceCents)}</div>
    </button>
  );
}

function RuleCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default function BuyChallengePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Suspense fallback={null}>
          <BuyChallengeForm />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
