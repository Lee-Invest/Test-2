import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES } from "@/lib/static-templates";
import { STATIC_PLATFORMS, STATIC_PLATFORM_AVAILABILITY } from "@/lib/static-platforms";
import { ConfiguratorClient } from "@/components/configurator-client";

// Server-rendered "Build Your Challenge" configurator. Everything a trader
// needs to complete a purchase — pick a size, pick a platform, agree to the
// rules, pay — works as plain HTML: changing a selection re-renders this
// same page via a GET <form>, and buying is a native POST to /api/checkout.
// <ConfiguratorClient> layers a live, no-reload preview on top of that exact
// same markup as a progressive enhancement (real client JS, since instant
// recalculation without a round trip genuinely cannot be done any other
// way) — if it never runs, the page is still fully functional through the
// GET/POST forms underneath it.
export default async function BuyChallengePage({
  searchParams,
}: {
  searchParams: { template?: string; platform?: string; coupon?: string; error?: string };
}) {
  const session = await getServerSession(authOptions);
  const templates = STATIC_TEMPLATES;
  const selected = templates.find((t) => t.id === searchParams.template) ?? templates[Math.floor(templates.length / 2)];
  const executionPlatforms = STATIC_PLATFORMS.filter((p) => p.mode === "EXECUTION");
  const analysisPlatforms = STATIC_PLATFORMS.filter((p) => p.mode === "ANALYSIS_ONLY");
  const platformId = executionPlatforms.some((p) => p.id === searchParams.platform) ? (searchParams.platform ?? "") : "";
  const couponCode = searchParams.coupon ?? "";

  const platformAvail = platformId
    ? STATIC_PLATFORM_AVAILABILITY.find((a) => a.templateId === selected.id && a.platformId === platformId)
    : undefined;
  const platformFeeCents = !platformAvail || platformAvail.allowed ? platformAvail?.feeCents ?? 0 : 0;
  const totalCents = selected.priceCents + platformFeeCents;

  return (
    <>
      <Nav />
      <main className="relative mx-auto max-w-6xl px-4 pb-32 pt-12 sm:px-6 sm:pb-16">
        {/* Ambient background glow — pure CSS, purely decorative. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(37,99,235,0.10),rgba(255,255,255,0)_70%)]"
        />

        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-accent)]">Get Funded</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">Build Your Challenge</h1>
          <p className="mt-4 text-lg text-gray-600">
            Configure your account step by step. Every number updates instantly as you go, and every price and rule
            is re-verified server-side the moment you check out.
          </p>
        </div>

        {searchParams.error && (
          <p className="mt-6 max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {searchParams.error}
          </p>
        )}

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px] lg:items-start">
          {/* LEFT / CENTER — configuration */}
          <div className="space-y-8">
            <Section step={1} title="Choose your program">
              <div className="rounded-2xl border border-white/60 bg-white/70 p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-gray-900">2-Step Challenge</h3>
                      <span className="rounded-full bg-[var(--brand-accent)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-accent)]">
                        Most Popular
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">
                      Classic evaluation for traders who prefer a structured, two-phase path to a funded account.
                    </p>
                  </div>
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                      <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0L3.3 9.5a1 1 0 1 1 1.4-1.4l3.9 3.9 6.7-6.7a1 1 0 0 1 1.4 0Z" />
                    </svg>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <MiniStat label="Phases" value="2" />
                  <MiniStat label="Payout model" value="Profit split" />
                  <MiniStat label="Best for" value="Structured traders" />
                  <MiniStat label="Reset option" value="Available" />
                </dl>
              </div>
              <p className="mt-3 text-xs text-gray-400">
                1-Step, Instant Funding, and Futures programs are configured by ApexFund and will appear here once
                enabled for your account.
              </p>
            </Section>

            <Section step={2} title="Choose your account size">
              <form method="GET" action="/pricing" id="configurator-form">
                <div
                  data-role="size-selector"
                  className="grid grid-cols-2 gap-3 sm:grid-cols-5"
                >
                  {templates.map((t) => (
                    <label
                      key={t.id}
                      data-size-option={t.id}
                      className="group relative cursor-pointer rounded-2xl border border-white/60 bg-white/60 p-4 text-center shadow-sm backdrop-blur-xl transition hover:bg-white/80 has-[:checked]:border-[var(--brand-primary)] has-[:checked]:bg-white has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/30"
                    >
                      <input
                        type="radio"
                        name="template"
                        value={t.id}
                        defaultChecked={t.id === selected.id}
                        className="peer sr-only"
                      />
                      <div className="text-lg font-bold text-gray-900">${(t.accountSize / 1000).toFixed(0)}K</div>
                      <div className="mt-1 text-xs text-gray-500">{formatCents(t.priceCents)}</div>
                      <div
                        aria-hidden
                        className="pointer-events-none absolute -top-2 -right-2 hidden h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white peer-checked:flex"
                      >
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3">
                          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0L3.3 9.5a1 1 0 1 1 1.4-1.4l3.9 3.9 6.7-6.7a1 1 0 0 1 1.4 0Z" />
                        </svg>
                      </div>
                    </label>
                  ))}
                </div>
                {/* Always visible, never JS/noscript-gated: the selection
                    ring above updates instantly via pure CSS regardless of
                    JS, and ConfiguratorClient live-updates the numbers below
                    without reloading — but if that script never runs for any
                    reason, this button is the one guaranteed way to actually
                    apply a new selection (full reload, same as before). */}
                <button
                  type="submit"
                  className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  data-role="apply-selection"
                >
                  Update
                </button>
              </form>

              <div className="mt-5 rounded-2xl border border-white/60 bg-white/70 p-5 shadow-sm backdrop-blur-xl" data-role="account-detail">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-gray-900" data-field="account-size">
                    ${selected.accountSize.toLocaleString()}
                  </span>
                  <span className="text-sm text-gray-500">
                    Evaluation Fee <span className="font-semibold text-gray-900" data-field="fee">{formatCents(selected.priceCents)}</span>
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <RuleRow label="Phase 1 Target" value={`${selected.phase1ProfitTargetPct}%`} field="p1-target" />
                  <RuleRow label="Phase 2 Target" value={`${selected.phase2ProfitTargetPct}%`} field="p2-target" />
                  <RuleRow label="Daily Loss" value={`${selected.maxDailyLossPct}%`} field="daily-loss" emphasis />
                  <RuleRow label="Maximum Loss" value={`${selected.maxOverallLossPct}%`} field="max-loss" emphasis />
                  <RuleRow
                    label="Min Trading Days"
                    value={`${selected.phase1MinTradingDays} / ${selected.phase2MinTradingDays}`}
                    field="min-days"
                  />
                  <RuleRow label="Profit Split" value={`${selected.profitSplitTraderPct}%`} field="profit-split" emphasis />
                </div>
              </div>
            </Section>

            <Section step={3} title="Choose your trading platform">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {executionPlatforms.map((p) => {
                  const avail = STATIC_PLATFORM_AVAILABILITY.find((a) => a.templateId === selected.id && a.platformId === p.id);
                  const allowed = avail?.allowed ?? true;
                  const fee = avail?.feeCents ?? 0;
                  const isSelected = p.id === platformId;
                  return (
                    <label
                      key={p.id}
                      data-platform-option={p.id}
                      data-allowed={allowed ? "1" : "0"}
                      className={`relative flex flex-col rounded-2xl border border-white/60 bg-white/60 p-5 shadow-sm backdrop-blur-xl transition hover:bg-white/80 has-[:checked]:border-[var(--brand-primary)] has-[:checked]:bg-white has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/30 ${
                        allowed ? "cursor-pointer" : "cursor-not-allowed opacity-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="platform"
                        form="configurator-form"
                        value={p.id}
                        disabled={!allowed}
                        defaultChecked={isSelected}
                        className="peer sr-only"
                      />
                      <div className="flex items-center gap-1.5">
                        {p.badges.map((b) => (
                          <span key={b} className="rounded-full bg-gray-900/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                            {b}
                          </span>
                        ))}
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-gray-900">{p.name}</h3>
                      <p className="mt-1 text-xs text-gray-500">{p.tagline}</p>
                      <ul className="mt-3 space-y-1 text-xs text-gray-600">
                        {p.features.map((f) => (
                          <li key={f} className="flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-gray-400" /> {f}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                          {!allowed ? (avail?.unavailableReason ?? "Not available") : fee > 0 ? `+${formatCents(fee)} fee` : "No extra fee"}
                        </span>
                        <span className="rounded-full border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 peer-checked:hidden">
                          Select
                        </span>
                        <span className="hidden rounded-full bg-[var(--brand-primary)] px-3 py-1 text-xs font-semibold text-white peer-checked:inline-block">
                          ✓ Selected
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {analysisPlatforms.length > 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white/40 p-4 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">Also available for chart analysis:</span>{" "}
                  {analysisPlatforms.map((p) => p.name).join(", ")} — used alongside your execution platform above,
                  not for placing trades directly.
                </div>
              )}

              <button
                type="submit"
                form="configurator-form"
                className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Apply platform selection
              </button>

              <ComparePlatforms platforms={STATIC_PLATFORMS} />
            </Section>
          </div>

          {/* RIGHT — sticky order summary (desktop) / sticky bottom bar (mobile) */}
          <OrderSummary
            selected={selected}
            platformId={platformId}
            platforms={executionPlatforms}
            platformFeeCents={platformFeeCents}
            totalCents={totalCents}
            couponCode={couponCode}
            loggedIn={Boolean(session?.user)}
          />
        </div>
      </main>
      <Footer />
      <ConfiguratorClient />
    </>
  );
}

function Section({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
          {step}
        </span>
        <h2 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-gray-400">{label}</dt>
      <dd className="mt-0.5 font-semibold text-gray-800">{value}</dd>
    </div>
  );
}

function RuleRow({ label, value, field, emphasis }: { label: string; value: string; field: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${emphasis ? "border-gray-900/10 bg-gray-900/[0.03]" : "border-gray-200 bg-gray-50"}`}>
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className={`mt-0.5 font-semibold text-gray-900 ${emphasis ? "text-base" : ""}`} data-field={field}>
        {value}
      </div>
    </div>
  );
}

function ComparePlatforms({ platforms }: { platforms: typeof STATIC_PLATFORMS }) {
  const rows: { key: keyof (typeof platforms)[number]["compare"]; label: string }[] = [
    { key: "web", label: "Web" },
    { key: "desktop", label: "Desktop" },
    { key: "mobile", label: "Mobile" },
    { key: "eas", label: "Expert Advisors" },
    { key: "algoTrading", label: "Algorithmic Trading" },
    { key: "advancedCharts", label: "Advanced Charts" },
    { key: "oneClickTrading", label: "One-click Trading" },
    { key: "marketExecution", label: "Market Execution" },
    { key: "customIndicators", label: "Custom Indicators" },
  ];

  return (
    <div className="mt-4">
      {/* Native <button popovertarget>/<div popover> — a browser-built modal
          with open/close handled entirely by the browser, zero JS. Falls
          back to a plain anchor jump on browsers that don't support the
          Popover API yet (progressive enhancement, not a hard requirement). */}
      <a
        href="#platform-comparison"
        // @ts-expect-error -- popovertarget is a valid HTML attribute not yet in React's JSX typings
        popovertarget="platform-comparison"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--brand-primary)] hover:underline"
      >
        Compare platforms
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
          <path d="M7.3 14.7a1 1 0 0 1 0-1.4L11.6 9 7.3 4.7a1 1 0 1 1 1.4-1.4l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4 0Z" />
        </svg>
      </a>

      <div
        id="platform-comparison"
        popover="auto"
        className="m-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl backdrop:bg-gray-900/40"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Compare platforms</h3>
          <a
            href="#"
            // @ts-expect-error -- popovertarget
            popovertarget="platform-comparison"
            popovertargetaction="hide"
            className="text-sm text-gray-400 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </a>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-gray-400">
                <th className="py-2 pr-4 font-medium">Feature</th>
                {platforms.map((p) => (
                  <th key={p.id} className="py-2 px-2 text-center font-medium">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-gray-100">
                  <td className="py-2 pr-4 text-gray-700">{row.label}</td>
                  {platforms.map((p) => (
                    <td key={p.id} className="py-2 px-2 text-center">
                      {p.compare[row.key] ? (
                        <span className="text-[var(--brand-primary)]">●</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrderSummary({
  selected,
  platformId,
  platforms,
  platformFeeCents,
  totalCents,
  couponCode,
  loggedIn,
}: {
  selected: (typeof STATIC_TEMPLATES)[number];
  platformId: string;
  platforms: typeof STATIC_PLATFORMS;
  platformFeeCents: number;
  totalCents: number;
  couponCode: string;
  loggedIn: boolean;
}) {
  const platform = platforms.find((p) => p.id === platformId);

  return (
    <aside
      data-role="order-summary"
      className="lg:sticky lg:top-24 fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-white/60 bg-white/90 p-5 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-2xl lg:static lg:rounded-3xl lg:border lg:border-white/60 lg:p-6 lg:shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_30px_rgba(15,23,42,0.06)]"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-400">Order Summary</h3>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Account size</span>
          <span className="font-medium text-gray-900" data-field="summary-size">
            ${selected.accountSize.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Platform</span>
          <span className="font-medium text-gray-900" data-field="summary-platform">
            {platform ? platform.name : "No preference"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Evaluation fee</span>
          <span className="font-medium text-gray-900" data-field="summary-fee">
            {formatCents(selected.priceCents)}
          </span>
        </div>
        {platformFeeCents > 0 && (
          <div className="flex justify-between" data-field="summary-platform-fee-row">
            <span className="text-gray-500">Platform fee</span>
            <span className="font-medium text-gray-900" data-field="summary-platform-fee">
              {formatCents(platformFeeCents)}
            </span>
          </div>
        )}
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Estimated first payout at 80% split, hitting both profit targets:{" "}
          <span className="font-semibold text-gray-700" data-field="summary-est-payout">
            {formatCents(Math.round(((selected.accountSize * 100) * Number(selected.phase2ProfitTargetPct)) / 100 * 0.8))}
          </span>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="text-sm text-gray-600">Total due today</span>
        <span className="text-2xl font-bold text-gray-900" data-field="summary-total">
          {formatCents(totalCents)}
        </span>
      </div>

      <form action="/api/checkout" method="POST" className="mt-4 space-y-3">
        <input type="hidden" name="templateId" value={selected.id} />
        {platformId && <input type="hidden" name="platformId" value={platformId} />}

        <input
          name="couponCode"
          defaultValue={couponCode}
          placeholder="Coupon code (optional)"
          className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
        />

        <label className="flex items-start gap-2 rounded-md p-1 text-xs text-gray-700">
          <input required name="agreedToRules" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
          <span>
            I agree to the Funded Trader Agreement and{" "}
            <a href="/rules" className="underline">
              Trading Rules
            </a>
            .
          </span>
        </label>

        {loggedIn ? (
          <button
            type="submit"
            style={{ backgroundColor: "#2563eb" }}
            className="w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:opacity-90"
          >
            Buy Challenge
          </button>
        ) : (
          <a
            href="/login?next=/pricing"
            style={{ backgroundColor: "#2563eb" }}
            className="block w-full rounded-xl px-4 py-3 text-center text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition hover:opacity-90"
          >
            Log in to buy this challenge
          </a>
        )}
      </form>
    </aside>
  );
}
