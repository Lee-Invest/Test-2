"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES, type StaticTemplate } from "@/lib/static-templates";
import { STATIC_PLATFORMS, STATIC_PLATFORM_AVAILABILITY } from "@/lib/static-platforms";
import { STATIC_ADDONS } from "@/lib/static-addons";
import { RuleTooltip } from "@/components/rule-tooltip";

// Rebuilt to use native <input type="radio"/checkbox"> for every selection
// in this form instead of div/button onClick handlers. A native form
// control's checked state is owned and rendered by the browser itself —
// clicking its <label> toggles it even if a JS event handler never runs at
// all, so the selection itself can never silently "do nothing" the way a
// custom onClick-driven card could. React only listens via onChange to
// keep price/summary state in sync; it isn't what makes the input itself
// interactive.

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

const trustPoints = [
  { icon: ShieldCheck, label: "Secure Checkout" },
  { icon: Check, label: "Transparent Rules" },
  { icon: Wallet, label: "Clear Pricing" },
];

const included = ["2 Evaluation Phases", "Trading Dashboard", "Server-Verified Risk Engine"];

function pctAmount(accountSize: number, pct: string) {
  const cents = Math.round(accountSize * 100 * (Number(pct) / 100));
  return `${pct}% (${formatCents(cents)})`;
}

function floorAfter(accountSize: number, pct: string) {
  return formatCents(accountSize * 100 - Math.round(accountSize * 100 * (Number(pct) / 100)));
}

interface CouponPreview {
  valid: boolean;
  reason?: string;
  discountCents?: number;
}

export function BuyChallengeForm() {
  const templates = STATIC_TEMPLATES;
  const [selectedId, setSelectedId] = useState<string>(templates[Math.floor(templates.length / 2)].id);
  const [platformId, setPlatformId] = useState<string>("");
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const agreeRef = useRef<HTMLInputElement>(null);
  const [showAgreeHint, setShowAgreeHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    const preselected = new URLSearchParams(window.location.search).get("template");
    if (preselected && templates.some((t) => t.id === preselected)) {
      setSelectedId(preselected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = templates.find((t) => t.id === selectedId) as StaticTemplate;
  const platform = STATIC_PLATFORMS.find((p) => p.id === platformId);
  const platformAvail = platform
    ? STATIC_PLATFORM_AVAILABILITY.find((a) => a.templateId === selected.id && a.platformId === platform.id)
    : undefined;
  const platformFeeCents = platform && (platformAvail?.allowed ?? true) ? platformAvail?.feeCents ?? 0 : 0;
  const chosenAddons = STATIC_ADDONS.filter((a) => addonIds.includes(a.id));
  const addonTotalCents = chosenAddons.reduce((sum, a) => sum + a.priceCents, 0);
  const discountCents = couponPreview?.valid ? couponPreview.discountCents ?? 0 : 0;
  const totalCents = selected.priceCents + platformFeeCents + addonTotalCents - discountCents;

  function selectAccountSize(id: string) {
    setSelectedId(id);
    setPlatformId("");
    setAddonIds([]);
    setCouponPreview(null);
  }

  function toggleAddon(id: string) {
    setAddonIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function checkCoupon() {
    if (!couponCode.trim()) {
      setCouponPreview(null);
      return;
    }
    setCouponChecking(true);
    try {
      const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(couponCode.trim())}&templateId=${selected.id}`);
      const data = await res.json().catch(() => null);
      setCouponPreview(data ?? { valid: false, reason: "Could not check that code." });
    } catch {
      setCouponPreview({ valid: false, reason: "Could not reach the server." });
    } finally {
      setCouponChecking(false);
    }
  }

  async function startCheckout() {
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
          platformId: platformId || undefined,
          addonIds: addonIds.length > 0 ? addonIds : undefined,
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
          <StepHeader step={1} title="Choose your program" />
          <div className="flex items-start gap-3 rounded-2xl border-2 border-[#b48c46] bg-[rgba(180,140,70,0.1)] p-4">
            <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b48c46] text-white">
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
              <label
                key={t.id}
                className={`relative flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 px-4 py-5 text-center transition ${
                  selectedId === t.id
                    ? "border-[#b48c46] bg-[rgba(180,140,70,0.1)]"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="account-size"
                  value={t.id}
                  checked={selectedId === t.id}
                  onChange={() => selectAccountSize(t.id)}
                  className="sr-only"
                />
                {selectedId === t.id && (
                  <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#b48c46] text-white">
                    <Check size={12} />
                  </div>
                )}
                <div className="text-lg font-bold text-gray-900">${t.accountSize.toLocaleString()}</div>
                <div className="text-xs text-gray-500">{formatCents(t.priceCents)}</div>
              </label>
            ))}
          </div>

          <StepHeader step={3} title="Choose your trading platform" className="mt-10" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STATIC_PLATFORMS.map((p) => {
              const avail = STATIC_PLATFORM_AVAILABILITY.find(
                (a) => a.templateId === selected.id && a.platformId === p.id
              );
              const allowed = avail?.allowed ?? true;
              const fee = avail?.feeCents ?? 0;
              const isSelected = platformId === p.id;
              return (
                <label
                  key={p.id}
                  className={`relative flex flex-col gap-2 rounded-2xl border-2 p-4 transition ${
                    !allowed
                      ? "cursor-not-allowed border-gray-100 bg-gray-50 opacity-60"
                      : isSelected
                      ? "cursor-pointer border-[#b48c46] bg-[rgba(180,140,70,0.1)]"
                      : "cursor-pointer border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="platform"
                    value={p.id}
                    disabled={!allowed}
                    checked={isSelected}
                    onChange={() => setPlatformId(isSelected ? "" : p.id)}
                    className="sr-only"
                  />
                  {isSelected && allowed && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#b48c46] text-white">
                      <Check size={12} />
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {p.badges.map((b) => (
                      <span
                        key={b}
                        className="inline-flex items-center rounded-full bg-gray-900/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                  <div className="font-semibold text-gray-900">{p.name}</div>
                  <p className="text-xs text-gray-500">{p.tagline}</p>
                  <ul className="mt-1 space-y-1 text-xs text-gray-600">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-gray-400" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-2 text-xs font-semibold">
                    {!allowed ? (
                      <span className="text-gray-400">{avail?.unavailableReason ?? "Not available for this account size"}</span>
                    ) : fee > 0 ? (
                      <span className="text-gray-700">+{formatCents(fee)}</span>
                    ) : (
                      <span className="text-[var(--brand-accent)]">Included</span>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500">You can change your platform before your first trade.</p>

          <StepHeader step={4} title="Add-ons (optional)" className="mt-10" />
          <div className="grid gap-3 sm:grid-cols-3">
            {STATIC_ADDONS.map((a) => {
              const isSelected = addonIds.includes(a.id);
              return (
                <label
                  key={a.id}
                  className={`relative flex flex-col gap-1.5 rounded-2xl border-2 p-4 transition ${
                    isSelected
                      ? "cursor-pointer border-[#b48c46] bg-[rgba(180,140,70,0.1)]"
                      : "cursor-pointer border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAddon(a.id)}
                    className="sr-only"
                  />
                  {isSelected && (
                    <div className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#b48c46] text-white">
                      <Check size={12} />
                    </div>
                  )}
                  <div className="pr-6 font-semibold text-gray-900">{a.name}</div>
                  <p className="text-xs text-gray-500">{a.description}</p>
                  <div className="mt-auto pt-2 text-xs font-semibold text-gray-700">
                    {formatCents(a.priceCents)}
                    {a.billing === "MONTHLY" ? "/mo" : ""}
                  </div>
                </label>
              );
            })}
          </div>

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
        </div>

        <div>
          <div className="rounded-2xl border border-white/40 bg-white/25 p-6 shadow-[0_8px_32px_rgba(31,38,135,0.08)] backdrop-blur-2xl">
            <div className="text-lg font-bold text-gray-900">Your Challenge</div>

            <dl className="mt-4 space-y-2 text-sm">
              <SummaryRow label="Account" value={`$${selected.accountSize.toLocaleString()}`} />
              <SummaryRow label="Program" value="2-Step Evaluation" />
              <SummaryRow label="Platform" value={platform ? platform.name : "Not chosen yet"} />
              {chosenAddons.map((a) => (
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
