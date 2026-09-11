import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyCoupon } from "@/lib/risk-engine";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES } from "@/lib/static-templates";
import { STATIC_PLATFORMS, STATIC_PLATFORM_AVAILABILITY } from "@/lib/static-platforms";
import { STATIC_ADDONS } from "@/lib/static-addons";
import { getMultiAccountDiscountPct } from "@/lib/multi-account-discount";
import { ConfiguratorClient } from "@/components/configurator-client";
import type { ChallengeProgram, PaymentMethod } from "@prisma/client";

// Fallback if the ChallengeProgram table is briefly unreachable or empty
// (e.g. before the migration/seed has run) — matches the row the migration
// seeds by default, so display never breaks even if the query does.
const FALLBACK_PROGRAM: Pick<ChallengeProgram, "id" | "name" | "slug" | "description" | "phaseCount" | "payoutModel" | "bestFor" | "mostPopular"> = {
  id: "",
  name: "2-Step Challenge",
  slug: "2-step",
  description: "Classic evaluation for traders who prefer a structured, two-phase path to a funded account.",
  phaseCount: 2,
  payoutModel: "Profit split",
  bestFor: "Structured traders",
  mostPopular: true,
};

const WHATS_INCLUDED = [
  "2 Evaluation Phases",
  "Trading Dashboard",
  "Risk Monitoring",
  "Performance Analytics",
  "Trader Academy",
];

const FAQS = [
  {
    q: "Which platform should I choose?",
    a: "MetaTrader 5 covers the most instruments and full algorithmic support. MetaTrader 4 is the simplest and most widely supported by third-party tools. cTrader and Match-Trader are fully browser-capable if you don't want to install anything.",
  },
  {
    q: "Can I change platforms after purchase?",
    a: "Your platform is tied to your account for the length of the evaluation. Contact support if you need to discuss switching.",
  },
  {
    q: "What happens after I pass?",
    a: "Passing Phase 1 moves you to Phase 2 with the same starting balance. Passing Phase 2 moves you to a funded account under the profit split shown above.",
  },
  {
    q: "When can I request a payout?",
    a: "Once your account is funded, eligible payouts appear on your dashboard's Payouts tab based on the minimum payout amount and payout cycle for your account size.",
  },
  {
    q: "What are the drawdown rules?",
    a: "Every account has a maximum daily loss and a maximum overall loss, both shown above and re-checked automatically on every trade.",
  },
  {
    q: "Are there time limits?",
    a: "There's no maximum time limit to pass a phase, only a minimum number of trading days, shown above.",
  },
  {
    q: "What payment methods are available?",
    a: "Available payment methods are shown at checkout and depend on what's currently enabled for your region.",
  },
];

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
  searchParams: {
    template?: string;
    platform?: string;
    coupon?: string;
    program?: string;
    addon?: string | string[];
    payment?: string;
    error?: string;
    saved?: string;
    shareUrl?: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const templates = STATIC_TEMPLATES;
  const selected = templates.find((t) => t.id === searchParams.template) ?? templates[Math.floor(templates.length / 2)];
  const executionPlatforms = STATIC_PLATFORMS.filter((p) => p.mode === "EXECUTION");
  const analysisPlatforms = STATIC_PLATFORMS.filter((p) => p.mode === "ANALYSIS_ONLY");
  const platformId = executionPlatforms.some((p) => p.id === searchParams.platform) ? (searchParams.platform ?? "") : "";
  const couponCode = searchParams.coupon ?? "";

  // Admin-configurable programs, payment methods, add-ons — all resilient
  // to a briefly unreachable database (falls back to sane display data
  // rather than breaking the page, same rationale as STATIC_TEMPLATES).
  const programs = await prisma.challengeProgram
    .findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } })
    .catch(() => [] as ChallengeProgram[]);
  const activePrograms = programs.length > 0 ? programs : [FALLBACK_PROGRAM as ChallengeProgram];
  const selectedProgram =
    activePrograms.find((p) => p.id === searchParams.program) ??
    activePrograms.find((p) => p.mostPopular) ??
    activePrograms[0];

  const paymentMethods = await prisma.paymentMethod
    .findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } })
    .catch(() => [] as PaymentMethod[]);
  const selectedPayment = paymentMethods.some((m) => m.key === searchParams.payment) ? searchParams.payment! : paymentMethods[0]?.key ?? "";

  const selectedAddonIds = (Array.isArray(searchParams.addon) ? searchParams.addon : searchParams.addon ? [searchParams.addon] : []).filter(
    (id) => STATIC_ADDONS.some((a) => a.id === id)
  );
  const selectedAddons = STATIC_ADDONS.filter((a) => selectedAddonIds.includes(a.id));
  const addonTotalCents = selectedAddons.reduce((sum, a) => sum + a.priceCents, 0);

  const multiAccountDiscount = session?.user ? await getMultiAccountDiscountPct(session.user.id) : null;

  const platformAvail = platformId
    ? STATIC_PLATFORM_AVAILABILITY.find((a) => a.templateId === selected.id && a.platformId === platformId)
    : undefined;
  const platformFeeCents = !platformAvail || platformAvail.allowed ? platformAvail?.feeCents ?? 0 : 0;

  // Live discount preview only — /api/checkout re-runs this exact same
  // applyCoupon() logic authoritatively at purchase time, so this can never
  // be used to manipulate the final price actually charged.
  let discountCents = 0;
  let couponError: string | null = null;
  if (couponCode) {
    const coupon = await prisma.coupon.findUnique({ where: { code: couponCode.toUpperCase() } });
    const calc = applyCoupon(
      selected.priceCents,
      coupon && (!coupon.templateId || coupon.templateId === selected.id)
        ? {
            type: coupon.type,
            value: Number(coupon.value),
            active: coupon.active,
            expiresAt: coupon.expiresAt,
            maxRedemptions: coupon.maxRedemptions,
            timesRedeemed: coupon.timesRedeemed,
          }
        : null
    );
    if (calc.couponValid) {
      discountCents = calc.discountCents;
    } else {
      couponError = coupon ? calc.reason ?? "Coupon not valid." : "Coupon not found.";
    }
  }
  const couponApplied = Boolean(couponCode) && !couponError;
  if (!couponApplied && multiAccountDiscount) {
    discountCents = Math.round((selected.priceCents * multiAccountDiscount.pct) / 100);
  }
  const totalCents = selected.priceCents - discountCents + platformFeeCents + addonTotalCents;

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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {activePrograms.map((program) => (
                  <label
                    key={program.id || program.slug}
                    className="relative cursor-pointer rounded-2xl border border-white/60 bg-white/70 p-5 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl transition has-[:checked]:border-[var(--brand-primary)] has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/30"
                  >
                    <input
                      type="radio"
                      name="program"
                      form="configurator-form"
                      value={program.id}
                      defaultChecked={program.id === selectedProgram.id}
                      className="peer sr-only"
                    />
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-gray-900">{program.name}</h3>
                          {program.mostPopular && (
                            <span className="rounded-full bg-[var(--brand-accent)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-accent)]">
                              Most Popular
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-600">{program.description}</p>
                      </div>
                      <div className="hidden h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)] text-white peer-checked:flex">
                        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                          <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0L3.3 9.5a1 1 0 1 1 1.4-1.4l3.9 3.9 6.7-6.7a1 1 0 0 1 1.4 0Z" />
                        </svg>
                      </div>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                      <MiniStat label="Phases" value={program.phaseCount === 0 ? "0 (Instant)" : program.phaseCount.toString()} />
                      <MiniStat label="Payout model" value={program.payoutModel} />
                      <MiniStat label="Best for" value={program.bestFor || "—"} />
                      <MiniStat label="Reset option" value="Available" />
                    </dl>
                  </label>
                ))}
              </div>
              <button
                type="submit"
                form="configurator-form"
                className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Apply program selection
              </button>
              <p className="mt-3 text-xs text-gray-400">
                <a href="/pricing/wizard" className="underline hover:text-gray-600">
                  Not sure which one fits you? Help me choose →
                </a>
              </p>
            </Section>

            <Section step={2} title="Choose your account size">
              <form method="GET" action="/pricing" id="configurator-form">
                <input type="hidden" name="coupon" value={couponCode} />
                <div data-role="size-selector" className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {templates.map((t) => {
                    const isChecked = t.id === selected.id;
                    const isGold = t.accountSize === 200_000;
                    const isUnique = t.accountSize === 25_000 || t.accountSize === 50_000;
                    const estCents = Math.round(
                      t.accountSize * 100 * (Number(t.phase1ProfitTargetPct) / 100) * (Number(t.profitSplitTraderPct) / 100)
                    );
                    return (
                      <label
                        key={t.id}
                        data-size-option={t.id}
                        className="relative flex cursor-pointer flex-col rounded-2xl border bg-white/70 p-5 pt-7 shadow-[0_8px_32px_rgba(31,38,135,0.06)] backdrop-blur-2xl transition hover:bg-white/90 has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/40"
                        style={{ borderColor: isGold ? "#b48c46" : "rgba(15,23,42,0.1)", borderWidth: isGold ? 2 : 1 }}
                      >
                        <input type="radio" name="template" value={t.id} defaultChecked={isChecked} className="peer sr-only" />

                        {isUnique && (
                          <div
                            className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white"
                            style={{ backgroundColor: "#b48c46" }}
                          >
                            Unique
                          </div>
                        )}

                        <div className="text-center">
                          <div className="text-xs uppercase tracking-wide text-gray-500">Account Size</div>
                          <div className="text-xl font-bold text-gray-900">${t.accountSize.toLocaleString()}</div>
                        </div>

                        <div className="mt-4 text-center">
                          <div className="text-2xl font-bold text-gray-900">{formatCents(t.priceCents)}</div>
                          <div className="text-xs text-gray-500">One-Time Evaluation Fee</div>
                        </div>

                        <span className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 peer-checked:hidden">
                          Select
                        </span>
                        <span
                          className="mt-4 hidden items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white peer-checked:flex"
                          style={{ backgroundColor: "#1d3557" }}
                        >
                          ✓ Selected
                        </span>

                        <div className="mt-3 text-center text-xs text-gray-500">
                          Estimated First Payout{" "}
                          <span className="font-semibold text-[var(--brand-accent)]">{formatCents(estCents)}</span>
                        </div>

                        <dl className="mt-5 space-y-3 border-t border-gray-200 pt-4 text-xs">
                          <SizeCardRow label="Phase 1 Target" value={`${t.phase1ProfitTargetPct}%`} />
                          <SizeCardRow label="Phase 2 Target" value={`${t.phase2ProfitTargetPct}%`} />
                          <SizeCardRow label="Max Daily Loss" value={`${t.maxDailyLossPct}%`} />
                          <SizeCardRow label="Max Total Loss" value={`${t.maxOverallLossPct}%`} />
                          <SizeCardRow label="Min Trading Days" value={`${t.phase1MinTradingDays} days`} />
                          <SizeCardRow label="Profit Split" value={`${t.profitSplitTraderPct}%`} accent />
                        </dl>
                      </label>
                    );
                  })}
                </div>
                {/* Always visible, never JS/noscript-gated: the selection
                    ring above updates instantly via pure CSS regardless of
                    JS, and ConfiguratorClient live-updates the rest of the
                    page without reloading — but if that script never runs
                    for any reason, this button is the one guaranteed way to
                    actually apply a new selection (full reload, same as
                    before). */}
                <button
                  type="submit"
                  className="mt-5 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  data-role="apply-selection"
                >
                  Update
                </button>
              </form>
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

            <Section step={4} title="Add-ons">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {STATIC_ADDONS.map((addon) => (
                  <label
                    key={addon.id}
                    className="cursor-pointer rounded-2xl border border-white/60 bg-white/60 p-4 shadow-sm backdrop-blur-xl transition hover:bg-white/80 has-[:checked]:border-[var(--brand-primary)] has-[:checked]:bg-white has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{addon.name}</h3>
                      <input
                        type="checkbox"
                        name="addon"
                        form="configurator-form"
                        value={addon.id}
                        defaultChecked={selectedAddonIds.includes(addon.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">{addon.description}</p>
                    <p className="mt-2 text-sm font-semibold text-gray-900">
                      {formatCents(addon.priceCents)}
                      {addon.billing === "MONTHLY" && <span className="font-normal text-gray-400">/mo</span>}
                    </p>
                  </label>
                ))}
              </div>
              {/* No submit button here on purpose: ConfiguratorClient
                  auto-submits the configurator form the instant an add-on
                  checkbox changes. The "Update" button in step 2 is still
                  the guaranteed no-JS fallback — it submits this same form,
                  add-ons included. */}
            </Section>

            {paymentMethods.length > 0 && (
              <Section step={5} title="Payment method">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {paymentMethods.map((m) => (
                    <label
                      key={m.id}
                      className="cursor-pointer rounded-2xl border border-white/60 bg-white/60 p-3 text-center text-sm font-medium text-gray-700 shadow-sm backdrop-blur-xl transition hover:bg-white/80 has-[:checked]:border-[var(--brand-primary)] has-[:checked]:bg-white has-[:checked]:text-gray-900 has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/30"
                    >
                      <input
                        type="radio"
                        name="payment"
                        form="configurator-form"
                        value={m.key}
                        defaultChecked={m.key === selectedPayment}
                        className="peer sr-only"
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  form="configurator-form"
                  className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Apply payment method
                </button>
              </Section>
            )}

            <Section step={6} title="Coupon code">
              <form method="GET" action="/pricing" className="flex flex-col gap-3 sm:flex-row">
                <input type="hidden" name="template" value={selected.id} />
                {platformId && <input type="hidden" name="platform" value={platformId} />}
                {selectedProgram.id && <input type="hidden" name="program" value={selectedProgram.id} />}
                {selectedAddonIds.map((id) => (
                  <input key={id} type="hidden" name="addon" value={id} />
                ))}
                {selectedPayment && <input type="hidden" name="payment" value={selectedPayment} />}
                <input
                  name="coupon"
                  defaultValue={couponCode}
                  placeholder="Enter a coupon code (optional)"
                  className="flex-1 rounded-xl border border-white/60 bg-white/70 px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none backdrop-blur-xl focus:border-[var(--brand-primary)]"
                />
                <button
                  type="submit"
                  className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Apply
                </button>
              </form>
              {couponCode && couponError && <p className="mt-2 text-xs text-red-600">{couponError}</p>}
              {couponCode && !couponError && (
                <p className="mt-2 text-xs text-green-700">
                  Coupon applied — {formatCents(discountCents)} off.
                </p>
              )}
            </Section>

            <TrustSection />
            <FaqSection />
          </div>

          {/* RIGHT — sticky order summary (desktop) / sticky bottom bar (mobile) */}
          <OrderSummary
            selected={selected}
            platformId={platformId}
            platforms={executionPlatforms}
            platformFeeCents={platformFeeCents}
            program={selectedProgram}
            addons={selectedAddons}
            addonTotalCents={addonTotalCents}
            paymentMethod={selectedPayment}
            discountCents={discountCents}
            couponCode={couponCode}
            couponError={couponError}
            totalCents={totalCents}
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

function SizeCardRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`font-semibold ${accent ? "text-[var(--brand-accent)]" : "text-gray-900"}`}>{value}</dd>
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
  program,
  addons,
  addonTotalCents,
  paymentMethod,
  discountCents,
  couponCode,
  couponError,
  totalCents,
  loggedIn,
}: {
  selected: (typeof STATIC_TEMPLATES)[number];
  platformId: string;
  platforms: typeof STATIC_PLATFORMS;
  platformFeeCents: number;
  program: ChallengeProgram;
  addons: (typeof STATIC_ADDONS)[number][];
  addonTotalCents: number;
  paymentMethod: string;
  discountCents: number;
  couponCode: string;
  couponError: string | null;
  totalCents: number;
  loggedIn: boolean;
}) {
  const platform = platforms.find((p) => p.id === platformId);
  const hasValidCoupon = Boolean(couponCode) && !couponError;
  const discountLabel = hasValidCoupon ? "Discount (coupon)" : "Discount (repeat account)";
  // Illustrative only — see the disclaimer below. Based on hitting the
  // Phase 2 profit target on the chosen account size at an 80% split.
  const estimatedPayoutCents = Math.round(selected.accountSize * 100 * (Number(selected.phase2ProfitTargetPct) / 100) * 0.8);

  return (
    <aside
      data-role="order-summary"
      className="lg:sticky lg:top-24 fixed inset-x-0 bottom-0 z-30 rounded-t-3xl border-t border-white/60 bg-white/90 p-5 shadow-[0_-8px_30px_rgba(15,23,42,0.12)] backdrop-blur-2xl lg:static lg:rounded-3xl lg:border lg:border-white/60 lg:p-6 lg:shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_8px_30px_rgba(15,23,42,0.06)]"
    >
      <h3 className="text-lg font-semibold tracking-tight text-gray-900">Your Challenge</h3>

      <div className="mt-4 space-y-2 text-sm">
        <SummaryRow label="Account" value={`$${selected.accountSize.toLocaleString()}`} field="summary-size" />
        <SummaryRow label="Program" value={program.name} field="summary-program" />
        <SummaryRow label="Platform" value={platform ? platform.name : "No preference"} field="summary-platform" />
        <SummaryRow
          label="Add-ons"
          value={addons.length > 0 ? addons.map((a) => a.name).join(", ") : "None"}
          field="summary-addons"
        />
        {paymentMethod && <SummaryRow label="Payment" value={paymentMethod.replace("_", " ")} field="summary-payment" />}
      </div>

      <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm">
        <SummaryRow label="Subtotal" value={formatCents(selected.priceCents)} field="summary-subtotal" />
        {platformFeeCents > 0 && (
          <SummaryRow label="Platform fee" value={formatCents(platformFeeCents)} field="summary-platform-fee" />
        )}
        {addonTotalCents > 0 && <SummaryRow label="Add-ons" value={formatCents(addonTotalCents)} field="summary-addon-total" />}
        {discountCents > 0 && (
          <SummaryRow label={discountLabel} value={`-${formatCents(discountCents)}`} field="summary-discount" negative />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="text-sm text-gray-600">Total</span>
        <span className="text-2xl font-bold text-gray-900" data-field="summary-total">
          {formatCents(totalCents)}
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <div className="text-xs uppercase tracking-wide text-gray-400">Estimated First Payout</div>
        <div className="mt-1 text-xl font-bold text-gray-900" data-field="summary-est-payout">
          {formatCents(estimatedPayoutCents)}
        </div>
        <p className="mt-1 text-[11px] leading-snug text-gray-500">
          Example only, based on this account size, an 80% profit split, and reaching the Phase 2 profit target.
          Not a guarantee of profit or payout — actual results depend entirely on your trading.
        </p>
      </div>

      <div className="mt-4 border-t border-gray-200 pt-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">What&apos;s included</div>
        <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
          {WHATS_INCLUDED.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="text-[var(--brand-primary)]">✓</span> {item}
            </li>
          ))}
        </ul>
      </div>

      <form action="/api/checkout" method="POST" className="mt-4 space-y-3 border-t border-gray-200 pt-4">
        <input type="hidden" name="templateId" value={selected.id} />
        {platformId && <input type="hidden" name="platformId" value={platformId} />}
        {program.id && <input type="hidden" name="programId" value={program.id} />}
        {addons.map((a) => (
          <input key={a.id} type="hidden" name="addonIds" value={a.id} />
        ))}
        {paymentMethod && <input type="hidden" name="paymentMethod" value={paymentMethod} />}
        {hasValidCoupon && <input type="hidden" name="couponCode" value={couponCode} />}

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

function SummaryRow({ label, value, field, negative }: { label: string; value: string; field: string; negative?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${negative ? "text-green-700" : "text-gray-900"}`} data-field={field}>
        {value}
      </span>
    </div>
  );
}

function TrustSection() {
  const items = [
    { title: "Secure Checkout", body: "Encrypted end to end, every purchase re-verified server-side.", icon: "🔒" },
    { title: "Transparent Rules", body: "Every limit and target is shown before you pay — no fine print.", icon: "📄" },
    { title: "Clear Pricing", body: "The price you see is the price you pay. No hidden fees.", icon: "💳" },
    { title: "24/7 Support", body: "A real person is reachable whenever you need help.", icon: "🕒" },
  ];
  return (
    <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.title} className="rounded-2xl border border-white/60 bg-white/60 p-4 text-center shadow-sm backdrop-blur-xl">
          <div className="text-xl" aria-hidden>
            {item.icon}
          </div>
          <div className="mt-2 text-xs font-semibold text-gray-900">{item.title}</div>
          <p className="mt-1 text-[11px] leading-snug text-gray-500">{item.body}</p>
        </div>
      ))}
    </section>
  );
}

function FaqSection() {
  return (
    <section>
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">Frequently asked questions</h2>
      <div className="mt-4 divide-y divide-gray-200 rounded-2xl border border-white/60 bg-white/60 shadow-sm backdrop-blur-xl">
        {FAQS.map((item) => (
          // Native <details>/<summary> — an accordion the browser implements
          // itself, no JS required to open/close.
          <details key={item.q} className="group p-4">
            <summary className="cursor-pointer list-none text-sm font-medium text-gray-900 marker:content-none">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span className="text-gray-400 transition group-open:rotate-45">+</span>
              </span>
            </summary>
            <p className="mt-2 text-sm text-gray-600">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
