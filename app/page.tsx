import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { branding } from "@/lib/branding";

const steps = [
  { title: "Pick a challenge", body: "Choose an account size from $10K to $200K and pay a one-time evaluation fee." },
  { title: "Pass two phases", body: "Hit the profit target in Phase 1 and Phase 2 while respecting the drawdown rules." },
  { title: "Get funded", body: "Trade a funded account and keep up to 80% of the profits you generate." },
];

const stats = [
  { label: "Account sizes", value: "$10K – $200K" },
  { label: "Profit split", value: "Up to 80%" },
  { label: "Evaluation phases", value: "2" },
  { label: "Payout cadence", value: "On request" },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-accent)]">
              {branding.name} Trader Challenge
            </p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              Trade our capital. Keep the upside.
            </h1>
            <p className="mt-6 text-lg text-white/70">
              {branding.name} funds skilled traders who can demonstrate consistent, disciplined risk management
              through a structured two-phase evaluation. Clear rules, transparent pricing, no guesswork.
            </p>
            <div className="mt-8 flex gap-4">
              <Link
                href="/pricing"
                className="rounded-md bg-[var(--brand-primary)] px-6 py-3 text-sm font-semibold hover:opacity-90"
              >
                View Challenges
              </Link>
              <Link href="/how-it-works" className="rounded-md border border-white/20 px-6 py-3 text-sm font-semibold hover:bg-white/5">
                How It Works
              </Link>
            </div>
          </div>

          <div className="mt-16 grid grid-cols-2 gap-6 border-t border-white/10 pt-10 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-sm text-white/50">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#0e0e1a] py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold">Three steps to a funded account</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-3">
              {steps.map((step, i) => (
                <div key={step.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="text-sm font-semibold text-[var(--brand-accent)]">Step {i + 1}</div>
                  <div className="mt-2 text-lg font-semibold">{step.title}</div>
                  <p className="mt-2 text-sm text-white/60">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <h2 className="text-2xl font-bold">Ready to prove your edge?</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/60">
            Every challenge rule — profit targets, drawdown limits, minimum trading days, and profit split — is
            transparent and configured the same way for every trader.
          </p>
          <Link
            href="/pricing"
            className="mt-6 inline-block rounded-md bg-[var(--brand-primary)] px-6 py-3 text-sm font-semibold hover:opacity-90"
          >
            Choose Your Account Size
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
