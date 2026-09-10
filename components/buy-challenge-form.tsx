"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES, type StaticTemplate } from "@/lib/static-templates";
import { RuleTooltip } from "@/components/rule-tooltip";
import { PlatformSelector } from "@/components/platform-selector";
import { AddonSelector } from "@/components/addon-selector";

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

function pctAmount(accountSize: number, pct: string) {
  const cents = Math.round(accountSize * 100 * (Number(pct) / 100));
  return `${pct}% (${formatCents(cents)})`;
}

function floorAfter(accountSize: number, pct: string) {
  return formatCents(accountSize * 100 - Math.round(accountSize * 100 * (Number(pct) / 100)));
}

const included = [
  "2 Evaluation Phases",
  "Trading Dashboard",
  "Server-Verified Risk Engine",
];

const trustPoints = [
  { icon: ShieldCheck, label: "Secure Checkout" },
  { icon: Check, label: "Transparent Rules" },
  { icon: Wallet, label: "Clear Pricing" },
];

interface SelectedAddon {
  id: string;
  name: string;
  priceCents: number;
}

interface CouponPreview {
  valid: boolean;
  reason?: string;
  discountCents?: number;
  totalCents?: number;
}

export function BuyChallengeForm() {
  const templates = STATIC_TEMPLATES;

  const [selectedId, setSelectedId] = useState<string | null>(
    templates[Math.floor(templates.length / 2)]?.id ?? null
  );
  const [platformId, setPlatformId] = useState<string | null>(null);
  const [platformFeeCents, setPlatformFeeCents] = useState(0);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
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

  // Switching account size can change (or remove) platform availability/fee
  // for the platform that was picked, so re-picking is required rather than
  // silently carrying over a now-invalid selection.
  useEffect(() => {
    setPlatformId(null);
    setPlatformFeeCents(0);
    setSelectedAddons([]);
    setCouponPreview(null);
  }, [selectedId]);

  const selected = templates.find((t) => t.id === selectedId);
  const addonTotalCents = selectedAddons.reduce((sum, a) => sum + a.priceCents, 0);
  const discountCents = couponPreview?.valid ? couponPreview.discountCents ?? 0 : 0;
  const totalCents = (selected?.priceCents ?? 0) + platformFeeCents + addonTotalCents - discountCents;

  async function checkCoupon() {
    if (!selected || !couponCode.trim()) {
      setCouponPreview(null);
      return;
    }
    setCouponChecking(true);
    try {
      const res = await fetch(
        `/api/coupons/validate?code=${encodeURIComponent(couponCode.trim())}&templateId=${selected.id}`
      );
      const data = await res.json().catch(() => null);
      setCouponPreview(data ?? { valid: false, reason: "Could not check that code." });
    } catch {
      setCouponPreview({ valid: false, reason: "Could not reach the server." });
    } finally {
      setCouponChecking(false);
    }
  }

  function toggleAddon(addon: { id: string; name: string; priceCents: number }) {
    setSelectedAddons((prev) =>
      prev.some((a) => a.id === addon.id) ? prev.filter((a) => a.id !== addon.id) : [...prev, addon]
    );
  }

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
          platformId: platformId ?? undefined,
          addonIds: selectedAddons.length > 0 ? selectedAddons.map((a) => a.id) : undefined,
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
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Build Your Challenge</h1>
        <p className="mt-3 text-gray-600">
          Choose your account size and trading platform, agree to the rules, then pay. Every price and rule is
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
        <span>80% Profit Split</span>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {/* Step 1 — Program (a single real program today; more can be
              added by an admin without touching this UI, once a Program
              model backs this section). */}
          <StepHeader step={1} title="Choose your program" />
          <div className="flex items-start gap-3 rounded-2xl border-2 border-[rgba(192,192,197,0.9)] bg-[rgba(192,192,197,0.15)] p-4">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(140,140,148,0.9)] text-white">
              <Check size={12} />
            </div>
            <div>
              <div className="font-semibold text-gray-900">2-Step Evaluation</div>
              <p className="mt-1 text-sm text-gray-600">
                The classic path: hit a profit target in Phase 1, confirm it with a second, smaller target in Phase
                2, then trade funded.
              </p>
            </div>
          </div>

          <StepHeader step={2} title="Choose your account size" className="mt-10" />
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {templates.map((t) => (
              <SizeCard key={t.id} template={t} selected={selectedId === t.id} onSelect={() => setSelectedId(t.id)} />
            ))}
          </div>

          {selected && (
            <>
              <StepHeader step={3} title="Choose your trading platform" className="mt-10" />
              <PlatformSelector
                templateId={selected.id}
                selectedId={platformId}
                onSelect={(id, fee) => {
                  setPlatformId(id);
                  setPlatformFeeCents(id ? fee : 0);
                }}
              />
              <p className="mt-2 text-xs text-gray-500">You can change your platform before your first trade.</p>

              <StepHeader step={4} title="Add-ons (optional)" className="mt-10" />
              <AddonSelector templateId={selected.id} selectedIds={selectedAddons.map((a) => a.id)} onToggle={toggleAddon} />

              <StepHeader step={5} title="Your challenge rules" className="mt-10" />
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
                  explain="You must place at least one trade on this many separate days in Phase 1 / Phase 2 respectively."
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

              <div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-2xl border border-white/40 bg-white/15 px-6 py-4">
                {trustPoints.map((t) => (
                  <div key={t.label} className="flex items-center gap-2 text-sm text-gray-600">
                    <t.icon size={16} className="text-[var(--brand-accent)]" />
                    {t.label}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Sticky order summary */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-white/40 bg-white/25 p-6 shadow-[0_8px_32px_rgba(31,38,135,0.08)] backdrop-blur-2xl">
            <div className="text-lg font-bold text-gray-900">Your Challenge</div>

            {selected ? (
              <dl className="mt-4 space-y-2 text-sm">
                <SummaryRow label="Account" value={`$${selected.accountSize.toLocaleString()}`} />
                <SummaryRow label="Program" value="2-Step Evaluation" />
                <SummaryRow label="Platform" value={platformId ? "Selected" : "Not chosen yet"} />
                {selectedAddons.map((a) => (
                  <SummaryRow key={a.id} label={a.name} value={formatCents(a.priceCents)} />
                ))}
                <div className="border-t border-gray-200 pt-2">
                  <SummaryRow label="Subtotal" value={formatCents(selected.priceCents)} />
                  {platformFeeCents > 0 && <SummaryRow label="Platform fee" value={`+${formatCents(platformFeeCents)}`} />}
                  {addonTotalCents > 0 && <SummaryRow label="Add-ons" value={`+${formatCents(addonTotalCents)}`} />}
                  {discountCents > 0 && (
                    <SummaryRow label={`Discount (${couponCode.toUpperCase()})`} value={`-${formatCents(discountCents)}`} />
                  )}
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 pt-2 text-base font-bold text-gray-900">
                  <span>Total</span>
                  <span>{formatCents(totalCents)}</span>
                </div>

                <div className="border-t border-gray-200 pt-2 text-xs text-gray-500">
                  Estimated First Payout{" "}
                  <span className="font-semibold text-[var(--brand-accent)]">
                    {formatCents(
                      Math.round(
                        selected.accountSize * 100 * (Number(selected.phase1ProfitTargetPct) / 100) * (Number(selected.profitSplitTraderPct) / 100)
                      )
                    )}
                  </span>
                  <p className="mt-0.5 text-[11px] text-gray-400">
                    An example based on this configuration — not a guaranteed return.
                  </p>
                </div>
              </dl>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Pick an account size to see your order summary.</p>
            )}

            <label className="mt-6 block text-xs text-gray-500">Coupon code (optional)</label>
            <div className="mt-1 flex gap-2">
              <input
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value);
                  setCouponPreview(null);
                }}
                placeholder="e.g. WELCOME10"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
              />
              <button
                type="button"
                onClick={checkCoupon}
                disabled={couponChecking || !couponCode.trim()}
                className="shrink-0 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {couponChecking ? "…" : "Apply"}
              </button>
            </div>
            {couponPreview && (
              <p className={`mt-1 text-xs ${couponPreview.valid ? "text-[var(--brand-accent)]" : "text-red-600"}`}>
                {couponPreview.valid ? `✓ ${couponCode.toUpperCase()} applied` : couponPreview.reason ?? "Invalid code."}
              </p>
            )}
            <p className="mt-1 text-[11px] text-gray-400">Discount is verified and re-applied server-side at checkout.</p>

            <div className="mt-5 space-y-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">What&rsquo;s included</div>
              {included.map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                  <Check size={12} className="text-[var(--brand-accent)]" />
                  {item}
                </div>
              ))}
            </div>

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
              disabled={loading || !selected}
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
      </div>
    </>
  );
}

function StepHeader({ step, title, className = "" }: { step: number; title: string; className?: string }) {
  return (
    <div className={`mb-4 flex items-center gap-2 ${className}`}>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
        {step}
      </span>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className="font-medium text-gray-900">{value}</dd>
    </div>
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
          ? "border-[rgba(192,192,197,0.9)] bg-[rgba(192,192,197,0.15)]"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      {selected && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(140,140,148,0.9)] text-white">
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
