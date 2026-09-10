"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
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
  phase2MinTradingDays: number;
  profitSplitTraderPct: string;
}

export default function PricingPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates ?? []);
        if (data.templates?.length) setSelectedId(data.templates[Math.floor(data.templates.length / 2)].id);
      });
  }, []);

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
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.orderId) {
        setMessage(`Order ${data.orderId} created. ${data.error ?? ""}`.trim());
      } else {
        setMessage(data.error ?? "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-white">Choose your challenge</h1>
        <p className="mt-2 max-w-2xl text-gray-300">
          All account sizes share the same rule structure across two evaluation phases before funding. Pick a size
          to see live pricing and rules pulled directly from our configuration.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedId(t.id)}
              className={`rounded-lg border px-5 py-3 text-sm font-semibold transition ${
                selectedId === t.id
                  ? "border-[var(--brand-primary)] bg-[var(--brand-primary)]/10 text-white"
                  : "border-white/15 text-gray-200 hover:border-gray-400"
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

            <div className="rounded-xl border border-white/10 bg-black/40 p-6 shadow-sm">
              <div className="text-sm text-gray-300">One-time evaluation fee</div>
              <div className="mt-1 text-3xl font-bold text-white">{formatCents(selected.priceCents)}</div>

              <label className="mt-6 block text-xs text-gray-500">Coupon code (optional)</label>
              <input
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="e.g. WELCOME10"
                className="mt-1 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-[var(--brand-primary)]"
              />

              <button
                onClick={startCheckout}
                disabled={loading}
                className="mt-6 w-full rounded-md bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Starting checkout…" : "Start Challenge"}
              </button>
              {message && <p className="mt-3 text-xs text-gray-300">{message}</p>}
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
    <div className="rounded-lg border border-white/10 bg-black/40 p-4">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}
