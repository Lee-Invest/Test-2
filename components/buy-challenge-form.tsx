"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES } from "@/lib/static-templates";
import { STATIC_PLATFORMS, STATIC_PLATFORM_AVAILABILITY } from "@/lib/static-platforms";

// Deliberately minimal: plain native <select> dropdowns for every choice
// instead of custom card/button UI. A <select> is one of the simplest,
// most universally-supported interactive elements in HTML — the browser
// owns opening it, choosing an option, and firing onChange, with nothing
// for a custom click handler to get in the way of.
export function BuyChallengeForm() {
  const templates = STATIC_TEMPLATES;
  const [selectedId, setSelectedId] = useState<string>(templates[Math.floor(templates.length / 2)].id);
  const [platformId, setPlatformId] = useState<string>("");
  const [couponCode, setCouponCode] = useState("");
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

  const selected = templates.find((t) => t.id === selectedId)!;
  const platformAvail = platformId
    ? STATIC_PLATFORM_AVAILABILITY.find((a) => a.templateId === selected.id && a.platformId === platformId)
    : undefined;
  const platformFeeCents = platformAvail?.allowed ?? true ? platformAvail?.feeCents ?? 0 : 0;
  const totalCents = selected.priceCents + platformFeeCents;

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
    <div className="max-w-xl">
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-accent)]">Get Funded</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Buy a Challenge</h1>
      <p className="mt-3 text-gray-600">
        Pick a size and platform, agree to the rules, then pay. Every price and rule is re-verified server-side at
        checkout.
      </p>

      <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-gray-700">Account size</label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setPlatformId("");
          }}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
        >
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              ${t.accountSize.toLocaleString()} — {formatCents(t.priceCents)}
            </option>
          ))}
        </select>

        <label className="mt-5 block text-sm font-medium text-gray-700">Trading platform</label>
        <select
          value={platformId}
          onChange={(e) => setPlatformId(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
        >
          <option value="">No preference</option>
          {STATIC_PLATFORMS.map((p) => {
            const avail = STATIC_PLATFORM_AVAILABILITY.find(
              (a) => a.templateId === selected.id && a.platformId === p.id
            );
            const allowed = avail?.allowed ?? true;
            const fee = avail?.feeCents ?? 0;
            return (
              <option key={p.id} value={p.id} disabled={!allowed}>
                {p.name}
                {!allowed ? " (not available for this account size)" : fee > 0 ? ` (+${formatCents(fee)})` : ""}
              </option>
            );
          })}
        </select>

        <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <RuleRow label="Phase 1 Target" value={`${selected.phase1ProfitTargetPct}%`} />
          <RuleRow label="Phase 2 Target" value={`${selected.phase2ProfitTargetPct}%`} />
          <RuleRow label="Max Daily Loss" value={`${selected.maxDailyLossPct}%`} />
          <RuleRow label="Max Total Loss" value={`${selected.maxOverallLossPct}%`} />
          <RuleRow label="Min Trading Days" value={`${selected.phase1MinTradingDays} / ${selected.phase2MinTradingDays}`} />
          <RuleRow label="Profit Split" value={`${selected.profitSplitTraderPct}% to you`} />
        </div>

        <label className="mt-6 block text-sm font-medium text-gray-700">Coupon code (optional)</label>
        <input
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          placeholder="e.g. WELCOME10"
          className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
        />

        <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
          <span className="text-sm text-gray-600">Total</span>
          <span className="text-2xl font-bold text-gray-900">{formatCents(totalCents)}</span>
        </div>

        <label
          className={`mt-4 flex items-start gap-2 rounded-md p-1 text-xs text-gray-700 ${showAgreeHint ? "ring-2 ring-amber-400" : ""}`}
        >
          <input
            ref={agreeRef}
            type="checkbox"
            defaultChecked={false}
            onChange={() => setShowAgreeHint(false)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300"
          />
          <span>
            I agree to the Funded Trader Agreement and{" "}
            <a href="/rules" className="underline">
              Trading Rules
            </a>{" "}
            for this account size.
          </span>
        </label>

        <button
          type="button"
          onClick={startCheckout}
          disabled={loading}
          style={{ backgroundColor: "#2563eb" }}
          className="mt-4 w-full rounded-md px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? "Starting checkout…" : "Buy Challenge"}
        </button>
        {showAgreeHint && (
          <p className="mt-2 text-xs text-amber-600">
            Please check the box above to agree to the Funded Trader Agreement before continuing.
          </p>
        )}
        {message && <p className="mt-3 text-xs text-gray-600">{message}</p>}
      </div>
    </div>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 font-semibold text-gray-900">{value}</div>
    </div>
  );
}
