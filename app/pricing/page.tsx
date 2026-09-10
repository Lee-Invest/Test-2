"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES } from "@/lib/static-templates";

export default function BuyChallengePage() {
  const templates = STATIC_TEMPLATES;
  const [selectedId, setSelectedId] = useState<string | null>(
    templates[Math.floor(templates.length / 2)]?.id ?? null
  );
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  const selected = templates.find((t) => t.id === selectedId);

  async function startCheckout() {
    if (!selected) return;
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
        body: JSON.stringify({ templateId: selected.id, couponCode: couponCode || undefined }),
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
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Buy Challenge</h1>
        <p className="mt-2 max-w-2xl text-gray-600">
          All account sizes share the same rule structure across two evaluation phases before funding. Pick a size
          to see the rules, then complete payment to activate your account — every price and rule shown here is
          re-verified server-side at checkout.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-lg border px-5 py-3 text-sm font-semibold transition ${
                selectedId === t.id
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-gray-900"
                  : "border-gray-300 text-gray-700 hover:border-gray-400"
              }`}
            >
              ${t.accountSize.toLocaleString()}
            </button>
          ))}
        </div>

        {selected && (
          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 grid gap-4 sm:grid-cols-2">
              <RuleCard label="Account Size" value={`$${selected.accountSize.toLocaleString()}`} />
              <RuleCard label="Price" value={formatCents(selected.priceCents)} />
              <RuleCard label="Phase 1 Profit Target" value={`${selected.phase1ProfitTargetPct}%`} />
              <RuleCard label="Phase 2 Profit Target" value={`${selected.phase2ProfitTargetPct}%`} />
              <RuleCard label="Max Daily Loss" value={`${selected.maxDailyLossPct}%`} />
              <RuleCard label="Max Overall Loss" value={`${selected.maxOverallLossPct}%`} />
              <RuleCard label="Min Trading Days (P1 / P2)" value={`${selected.phase1MinTradingDays} / ${selected.phase2MinTradingDays}`} />
              <RuleCard label="Funded Profit Split" value={`${selected.profitSplitTraderPct}% to you`} />
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="text-sm text-gray-600">One-time evaluation fee</div>
              <div className="mt-1 text-3xl font-bold text-gray-900">{formatCents(selected.priceCents)}</div>

              <label className="mt-6 block text-xs text-gray-500">Coupon code (optional)</label>
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="e.g. WELCOME10"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
              />

              <button
                onClick={startCheckout}
                disabled={loading}
                style={{ backgroundColor: "#1d3557" }}
                className="mt-6 w-full rounded-md px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Starting checkout…" : "Buy Challenge"}
              </button>
              {message && <p className="mt-3 text-xs text-gray-600">{message}</p>}
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
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
