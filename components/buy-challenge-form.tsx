"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES, type StaticTemplate } from "@/lib/static-templates";
import { RuleTooltip } from "@/components/rule-tooltip";

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
    body: "Trade a funded account and request payouts once you're eligible — you keep your profit split of every withdrawal. Your one-time evaluation fee is also refunded 100% the moment you get funded.",
  },
];

function pctAmount(accountSize: number, pct: string) {
  const cents = Math.round(accountSize * 100 * (Number(pct) / 100));
  return `${pct}% (${formatCents(cents)})`;
}

function floorAfter(accountSize: number, pct: string) {
  return formatCents(accountSize * 100 - Math.round(accountSize * 100 * (Number(pct) / 100)));
}

export function BuyChallengeForm() {
  const templates = STATIC_TEMPLATES;

  const [selectedId, setSelectedId] = useState<string | null>(
    templates[Math.floor(templates.length / 2)]?.id ?? null
  );
  const [couponCode, setCouponCode] = useState("");
  const agreeRef = useRef<HTMLInputElement>(null);
  const [showAgreeHint, setShowAgreeHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  // Read an optional ?template= param on mount (plain window.location, not
  // useSearchParams) so this page never needs a Suspense boundary around
  // that read — a useSearchParams()-in-Suspense page renders nothing from
  // the server until client JS finishes hydrating, which turned this page
  // blank if hydration was ever slow or failed. Reading the query string
  // after mount instead means the page's real content is already in the
  // server-rendered HTML.
  useEffect(() => {
    const preselected = new URLSearchParams(window.location.search).get("template");
    if (preselected && templates.some((t) => t.id === preselected)) {
      setSelectedId(preselected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = templates.find((t) => t.id === selectedId);

  async function startCheckout() {
    if (!selected) return;
    // Reads the real DOM checkbox value directly instead of trusting a
    // controlled-input state value — this button was reported as
    // permanently "stuck disabled" for some users even after checking the
    // box, which is consistent with something (a browser extension, page
    // translation, etc.) toggling the native checkbox without React's
    // change handler firing. Checking .checked here can never disagree with
    // what's actually on screen.
    if (!agreeRef.current?.checked) {
      setShowAgreeHint(true);
      agreeRef.current?.focus();
      return;
    }
    setShowAgreeHint(false);
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
          Pick a size, agree to the trading rules, then pay. Every price and rule is re-verified server-side at
          checkout.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-white/40 bg-white/25 px-5 py-3 text-xs font-semibold uppercase tracking-widest text-gray-600 backdrop-blur-xl">
        <span>Two-Phase Evaluation</span>
        <span className="text-gray-300">•</span>
        <span>Server-Verified Risk Engine</span>
        <span className="text-gray-300">•</span>
        <span>Transparent Pricing</span>
        <span className="text-gray-300">•</span>
        <span>80% Profit Split</span>
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
              <RuleCard
                label="Phase 1 Target"
                value={`${selected.phase1ProfitTargetPct}%`}
                explain={`Grow your account balance by ${selected.phase1ProfitTargetPct}% during Phase 1 to move on to Phase 2.`}
              />
              <RuleCard
                label="Phase 2 Target"
                value={`${selected.phase2ProfitTargetPct}%`}
                explain={`Hit a second, smaller ${selected.phase2ProfitTargetPct}% target in Phase 2 to get funded.`}
              />
              <RuleCard
                label="Max Daily Loss"
                value={pctAmount(selected.accountSize, selected.maxDailyLossPct)}
                explain={`Your equity can't drop more than ${selected.maxDailyLossPct}% below where it started that trading day, or the account fails.`}
              />
              <RuleCard
                label="Max Total Loss"
                value={pctAmount(selected.accountSize, selected.maxOverallLossPct)}
                explain={`Your balance can never fall more than ${selected.maxOverallLossPct}% below the starting $${selected.accountSize.toLocaleString()} — it must always stay above ${floorAfter(selected.accountSize, selected.maxOverallLossPct)}.`}
              />
              <RuleCard
                label="Min Trading Days"
                value={`${selected.phase1MinTradingDays} / ${selected.phase2MinTradingDays}`}
                explain={`You must place at least one trade on this many separate days in Phase 1 / Phase 2 respectively.`}
              />
              <RuleCard
                label="Profit Split"
                value={`${selected.profitSplitTraderPct}% to you`}
                explain={`Once funded, you keep ${selected.profitSplitTraderPct}% of the profits you withdraw.`}
              />
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
              By purchasing, you agree to trade this account in good faith, respect the loss limits above, avoid
              prohibited strategies, and accept that breaching a risk rule ends the evaluation. Full text on the{" "}
              <a href="/rules" className="underline">
                Trading Rules
              </a>{" "}
              page.
            </div>

            <label
              className={`mt-3 flex items-start gap-2 rounded-md p-1 text-xs text-gray-700 ${showAgreeHint ? "ring-2 ring-amber-400" : ""}`}
            >
              <input
                ref={agreeRef}
                type="checkbox"
                defaultChecked={false}
                onChange={() => setShowAgreeHint(false)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300"
              />
              <span>I agree to the Funded Trader Agreement and Trading Rules for this account size.</span>
            </label>

            <button
              type="button"
              onClick={startCheckout}
              disabled={loading}
              style={{ backgroundColor: "#2563eb" }}
              className="mt-6 w-full rounded-md px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Starting checkout…" : "Proceed Payout"}
            </button>
            {showAgreeHint && (
              <p className="mt-2 text-xs text-amber-600">
                Please check the box above to agree to the Funded Trader Agreement before continuing.
              </p>
            )}
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

function RuleCard({ label, value, explain }: { label: string; value: string; explain?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wide text-gray-400">
        {explain ? <RuleTooltip text={explain}>{label}</RuleTooltip> : label}
      </div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

