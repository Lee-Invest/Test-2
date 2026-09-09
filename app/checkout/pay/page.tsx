"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { formatCents } from "@/lib/utils";

interface OrderSummary {
  orderId: string;
  templateName: string;
  accountSize: number;
  totalCents: number;
  status: string;
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function SimulatedPaymentPage() {
  return (
    <Suspense fallback={null}>
      <SimulatedPaymentForm />
    </Suspense>
  );
}

function SimulatedPaymentForm() {
  const params = useSearchParams();
  const router = useRouter();
  const orderId = params.get("orderId");

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [cardNumber, setCardNumber] = useState("4242 4242 4242 4242");
  const [expiry, setExpiry] = useState("12/34");
  const [cvc, setCvc] = useState("123");
  const [name, setName] = useState("");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/checkout/confirm?orderId=${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setOrder(data);
      });
  }, [orderId]);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!orderId) return;
    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Payment could not be confirmed.");
        return;
      }
      router.push(`/checkout/success?orderId=${orderId}`);
    } finally {
      setPaying(false);
    }
  }

  if (!orderId) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
          <p className="text-white/70">Missing order. Start again from the pricing page.</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
          <strong>Simulated payment.</strong> No real Stripe account is configured for this
          environment — no card data is collected, transmitted, or charged anywhere. Submitting
          this form provisions your challenge account directly, the same way a real payment
          webhook would.
        </div>

        <div className="rounded-lg border border-white/10 bg-white/5 p-6">
          <h1 className="text-lg font-semibold">Complete your payment</h1>

          {order ? (
            <div className="mt-4 flex items-center justify-between border-b border-white/10 pb-4 text-sm">
              <span className="text-white/70">{order.templateName}</span>
              <span className="font-semibold">{formatCents(order.totalCents)}</span>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/50">Loading order…</p>
          )}

          <form onSubmit={handlePay} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs text-white/60">Cardholder name</label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Trader"
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-white/60">Card number</label>
              <input
                required
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="4242 4242 4242 4242"
                inputMode="numeric"
                className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm font-mono outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-white/60">Expiry</label>
                <input
                  required
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                  inputMode="numeric"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm font-mono outline-none focus:border-[var(--brand-primary)]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-white/60">CVC</label>
                <input
                  required
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="123"
                  inputMode="numeric"
                  className="w-full rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm font-mono outline-none focus:border-[var(--brand-primary)]"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={paying || !order}
              className="w-full rounded-md bg-[var(--brand-primary)] px-6 py-3 text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {paying ? "Processing…" : order ? `Pay ${formatCents(order.totalCents)}` : "Pay"}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
