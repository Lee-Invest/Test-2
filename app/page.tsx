import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { branding } from "@/lib/branding";
import { ChallengeCards } from "@/components/challenge-cards";
import { TreeAccent } from "@/components/tree-accent";

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
      <main className="relative">
        <TreeAccent side="left" />
        <TreeAccent side="right" />

        <section className="relative z-10 bg-white/35 pb-20 pt-8 backdrop-blur-2xl sm:pb-28 sm:pt-12">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-accent)]">
                {branding.name} Trader Challenge
              </p>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                Trade our capital. Keep the upside.
              </h1>
              <p className="mt-6 text-lg text-gray-600">
                {branding.name} funds skilled traders who can demonstrate consistent, disciplined risk management
                through a structured two-phase evaluation. Clear rules, transparent pricing, no guesswork.
              </p>
              <div className="mt-8 flex gap-4">
                <Link
                  href="#choose-challenge"
                  className="rounded-full border px-6 py-3 text-sm font-semibold text-white shadow-[0_2px_10px_rgba(0,0,0,0.25)] backdrop-blur-xl"
                  style={{ backgroundColor: "rgba(29, 53, 87, 0.75)", borderColor: "rgba(29, 53, 87, 0.5)" }}
                >
                  View Challenges
                </Link>
                <Link
                  href="/how-it-works"
                  className="rounded-full border border-white/50 bg-white/20 px-6 py-3 text-sm font-semibold text-gray-900 backdrop-blur-xl hover:bg-white/40"
                >
                  How It Works
                </Link>
              </div>
            </div>

            <div className="mt-16 grid grid-cols-2 gap-4 rounded-2xl border border-white/40 bg-white/15 p-6 shadow-[0_8px_32px_rgba(31,38,135,0.08)] backdrop-blur-2xl sm:grid-cols-4">
              {stats.map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-sm text-gray-600">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="relative z-30 overflow-hidden border-y border-white/40 bg-white/25 py-4 backdrop-blur-2xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-32 backdrop-blur-md"
            style={{
              WebkitMaskImage: "linear-gradient(to right, black, transparent)",
              maskImage: "linear-gradient(to right, black, transparent)",
              background: "var(--background)",
              opacity: 0.4,
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-32 backdrop-blur-md"
            style={{
              WebkitMaskImage: "linear-gradient(to left, black, transparent)",
              maskImage: "linear-gradient(to left, black, transparent)",
              background: "var(--background)",
              opacity: 0.4,
            }}
          />
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 text-center text-xs font-semibold uppercase tracking-widest text-gray-700 sm:px-6">
            <span>Two-Phase Evaluation</span>
            <span className="hidden text-gray-300 sm:inline">•</span>
            <span>Server-Verified Risk Engine</span>
            <span className="hidden text-gray-300 sm:inline">•</span>
            <span>Transparent Pricing</span>
            <span className="hidden text-gray-300 sm:inline">•</span>
            <span>Up to 80% Profit Split</span>
          </div>
        </div>

        <section id="choose-challenge" className="scroll-mt-20 py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-center text-2xl font-bold text-gray-900">Choose your challenge</h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-gray-600">
              Live pricing and rules pulled directly from our configuration — pick a size and start now.
            </p>
            <div className="mt-10">
              <ChallengeCards />
            </div>
          </div>
        </section>

        <section className="py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-bold text-gray-900">Three steps to a funded account</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {steps.map((step, i) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-white/40 bg-white/15 p-6 shadow-[0_8px_32px_rgba(31,38,135,0.08)] backdrop-blur-2xl"
                >
                  <div className="text-sm font-semibold text-[var(--brand-accent)]">Step {i + 1}</div>
                  <div className="mt-2 text-lg font-semibold text-gray-900">{step.title}</div>
                  <p className="mt-2 text-sm text-gray-600">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <div className="mx-auto max-w-2xl rounded-2xl border border-white/40 bg-white/15 p-10 shadow-[0_8px_32px_rgba(31,38,135,0.08)] backdrop-blur-2xl">
            <h2 className="text-2xl font-bold text-gray-900">Ready to prove your edge?</h2>
            <p className="mx-auto mt-3 max-w-xl text-gray-600">
              Every challenge rule — profit targets, drawdown limits, minimum trading days, and profit split — is
              transparent and configured the same way for every trader.
            </p>
            <Link
              href="/pricing"
              className="mt-6 inline-block rounded-full bg-[var(--brand-primary)]/90 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl hover:opacity-90"
            >
              Choose Your Account Size
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
