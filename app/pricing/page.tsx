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
    error?: string;
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
  // Describes *how* the discount was derived, not just its current cents
  // value, so ConfiguratorClient can recompute it correctly if the trader
  // then changes account size (a percent-based discount scales with the
  // new price; a fixed one doesn't) without a page reload.
  let discountMode: "none" | "percent" | "fixed" = "none";
  let discountValue = 0;
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
      discountMode = coupon!.type === "PERCENT" ? "percent" : "fixed";
      discountValue = coupon!.type === "PERCENT" ? Number(coupon!.value) : Math.round(Number(coupon!.value));
    } else {
      couponError = coupon ? calc.reason ?? "Coupon not valid." : "Coupon not found.";
    }
  }
  const couponApplied = Boolean(couponCode) && !couponError;
  if (!couponApplied && multiAccountDiscount) {
    discountCents = Math.round((selected.priceCents * multiAccountDiscount.pct) / 100);
    discountMode = "percent";
    discountValue = multiAccountDiscount.pct;
  }
  const totalCents = selected.priceCents - discountCents + platformFeeCents + addonTotalCents;

  return (
    <>
      <Nav />
      <main className="relative mx-auto max-w-[1440px] px-4 pb-32 pt-12 sm:px-6 sm:pb-16 lg:px-10">
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {activePrograms.map((program) => {
                  const steps =
                    program.phaseCount === 0
                      ? "Instant funding"
                      : program.phaseCount === 1
                      ? `${selected.phase1ProfitTargetPct}%`
                      : `${selected.phase1ProfitTargetPct}% → ${selected.phase2ProfitTargetPct}%`;
                  return (
                    <label
                      key={program.id || program.slug}
                      className="relative flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-xl transition has-[:checked]:border-[var(--brand-primary)] has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/30"
                    >
                      <input
                        type="radio"
                        name="program"
                        form="configurator-form"
                        value={program.id}
                        data-phase-count={program.phaseCount}
                        defaultChecked={program.id === selectedProgram.id}
                        className="peer sr-only"
                      />
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900">{program.name}</h3>
                        {program.mostPopular && (
                          <span className="rounded-full bg-[var(--brand-accent)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-accent)]">
                            Most Popular
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-gray-700" data-field={`program-steps-${program.id}`}>
                        {steps}
                      </span>
                    </label>
                  );
                })}
              </div>
              {/* Visually hidden, not removed: program selection
                  auto-submits via ConfiguratorClient, but this stays as the
                  real, keyboard/no-JS-reachable fallback. */}
              <button type="submit" form="configurator-form" className="sr-only">
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
                <div data-role="size-selector" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  {templates.map((t) => {
                    const isChecked = t.id === selected.id;
                    const isGold = t.accountSize === 200_000;
                    const isUnique = t.accountSize === 25_000 || t.accountSize === 50_000;
                    return (
                      <label
                        key={t.id}
                        data-size-option={t.id}
                        className="relative flex cursor-pointer flex-col items-center rounded-xl border bg-white/70 p-3 pt-5 text-center shadow-sm backdrop-blur-2xl transition hover:bg-white/90 has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/40"
                        style={{ borderColor: isGold ? "#b48c46" : "rgba(15,23,42,0.1)", borderWidth: isGold ? 2 : 1 }}
                      >
                        <input type="radio" name="template" value={t.id} defaultChecked={isChecked} className="peer sr-only" />

                        {isUnique && (
                          <div
                            className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                            style={{ backgroundColor: "#b48c46" }}
                          >
                            Unique
                          </div>
                        )}

                        <div className="text-base font-bold text-gray-900">${t.accountSize.toLocaleString()}</div>
                        <div className="mt-1 text-xs text-gray-500" data-field={`price-${t.id}`}>
                          {formatCents(t.priceCents)}
                        </div>

                        <span className="mt-2 rounded-full border border-gray-300 px-2.5 py-0.5 text-[10px] font-semibold text-gray-700 peer-checked:hidden">
                          Select
                        </span>
                        <span
                          className="mt-2 hidden rounded-full px-2.5 py-0.5 text-[10px] font-semibold text-white peer-checked:inline-block"
                          style={{ backgroundColor: "#1d3557" }}
                        >
                          ✓ Selected
                        </span>
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
                <button type="submit" className="sr-only" data-role="apply-selection">
                  Update
                </button>
              </form>
            </Section>

            <Section step={3} title="Choose your trading platform">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                      className={`relative flex flex-col items-center gap-2 rounded-xl border border-white/60 bg-white/60 p-3 text-center shadow-sm backdrop-blur-xl transition hover:bg-white/80 has-[:checked]:border-[var(--brand-primary)] has-[:checked]:bg-white has-[:checked]:ring-2 has-[:checked]:ring-[var(--brand-primary)]/30 ${
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
                      <PlatformLogo slug={p.slug} />
                      <h3 className="text-xs font-semibold text-gray-900">{p.name}</h3>
                      <span className="text-[10px] text-gray-400" data-field={`platform-note-${p.id}`}>
                        {!allowed ? avail?.unavailableReason ?? "Not available" : fee > 0 ? `+${formatCents(fee)}` : ""}
                      </span>
                      <span className="mt-1 rounded-full border border-gray-300 px-2.5 py-0.5 text-[10px] font-semibold text-gray-700 peer-checked:hidden">
                        Select
                      </span>
                      <span className="mt-1 hidden rounded-full bg-[var(--brand-primary)] px-2.5 py-0.5 text-[10px] font-semibold text-white peer-checked:inline-block">
                        ✓ Selected
                      </span>
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

              <button type="submit" form="configurator-form" className="sr-only">
                Apply platform selection
              </button>
            </Section>

            <Section step={4} title="Add-ons">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {STATIC_ADDONS.map((addon) => {
                  const pct = selected.priceCents > 0 ? Math.round((addon.priceCents / selected.priceCents) * 100) : 0;
                  return (
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
                          data-addon-name={addon.name}
                          data-addon-price-cents={addon.priceCents}
                          defaultChecked={selectedAddonIds.includes(addon.id)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300"
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500">{addon.description}</p>
                      <p className="mt-2 text-sm font-semibold text-gray-900" data-field={`addon-pct-${addon.id}`}>
                        +{pct}%{addon.billing === "MONTHLY" && <span className="font-normal text-gray-400">/mo</span>}
                      </p>
                    </label>
                  );
                })}
              </div>
              {/* No submit button here on purpose: ConfiguratorClient
                  auto-submits the configurator form the instant an add-on
                  checkbox changes. The "Update" button in step 2 is still
                  the guaranteed no-JS fallback — it submits this same form,
                  add-ons included. */}
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
            paymentMethods={paymentMethods}
            discountCents={discountCents}
            discountMode={discountMode}
            discountValue={discountValue}
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



function OrderSummary({
  selected,
  platformId,
  platforms,
  platformFeeCents,
  program,
  addons,
  addonTotalCents,
  paymentMethods,
  discountCents,
  discountMode,
  discountValue,
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
  paymentMethods: PaymentMethod[];
  discountCents: number;
  discountMode: "none" | "percent" | "fixed";
  discountValue: number;
  couponCode: string;
  couponError: string | null;
  totalCents: number;
  loggedIn: boolean;
}) {
  const platform = platforms.find((p) => p.id === platformId);
  const hasValidCoupon = Boolean(couponCode) && !couponError;
  const discountLabel = hasValidCoupon ? "Discount (coupon)" : "Discount (repeat account)";

  return (
    <aside
      data-role="order-summary"
      data-discount-mode={discountMode}
      data-discount-value={discountValue}
      data-discount-label={discountLabel}
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
      </div>

      <div className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-sm">
        <SummaryRow label="Subtotal" value={formatCents(selected.priceCents)} field="summary-subtotal" />
        <div data-role="summary-platform-fee-row" hidden={platformFeeCents === 0}>
          <SummaryRow label="Platform fee" value={formatCents(platformFeeCents)} field="summary-platform-fee" />
        </div>
        <div data-role="summary-addon-total-row" hidden={addonTotalCents === 0}>
          <SummaryRow label="Add-ons" value={formatCents(addonTotalCents)} field="summary-addon-total" />
        </div>
        <div data-role="summary-discount-row" hidden={discountCents === 0}>
          <SummaryRow label={discountLabel} value={`-${formatCents(discountCents)}`} field="summary-discount" negative />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
        <span className="text-sm text-gray-600">Total</span>
        <span className="text-2xl font-bold text-gray-900" data-field="summary-total">
          {formatCents(totalCents)}
        </span>
      </div>

      {/* Small, folded into the summary rather than its own step. Submits
          on its own (a plain GET, page reload — a coupon changes server-
          computed pricing, so it can't be a client-only preview) but stays
          visually part of "Your Challenge" instead of a numbered section. */}
      <form method="GET" action="/pricing" className="mt-4 flex gap-2 border-t border-gray-200 pt-4">
        <input type="hidden" name="template" value={selected.id} />
        {platformId && <input type="hidden" name="platform" value={platformId} />}
        {program.id && <input type="hidden" name="program" value={program.id} />}
        {addons.map((a) => (
          <input key={a.id} type="hidden" name="addon" value={a.id} />
        ))}
        <input
          name="coupon"
          defaultValue={couponCode}
          placeholder="Coupon code"
          className="flex-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs text-gray-900 outline-none focus:border-[var(--brand-primary)]"
        />
        <button type="submit" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
          Apply
        </button>
      </form>
      {couponCode && couponError && <p className="mt-1 text-xs text-red-600">{couponError}</p>}
      {couponCode && !couponError && <p className="mt-1 text-xs text-green-700">Coupon applied — {formatCents(discountCents)} off.</p>}

      {paymentMethods.length > 0 && (
        <p className="mt-4 text-[11px] text-gray-400">
          Accepted at checkout: {paymentMethods.map((m) => m.label).join(", ")}.
        </p>
      )}

      <form id="checkout-form" action="/api/checkout" method="POST" className="mt-4 space-y-3 border-t border-gray-200 pt-4">
        <input type="hidden" id="checkout-templateId" name="templateId" value={selected.id} />
        <input type="hidden" id="checkout-platformId" name="platformId" value={platformId} />
        <input type="hidden" id="checkout-programId" name="programId" value={program.id} />
        <span data-role="addon-hidden-fields">
          {addons.map((a) => (
            <input key={a.id} type="hidden" name="addonIds" value={a.id} />
          ))}
        </span>
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

const PLATFORM_LOGO_STYLE: Record<string, { initials: string; bg: string }> = {
  mt4: { initials: "MT4", bg: "#1d3557" },
  mt5: { initials: "MT5", bg: "#1d3557" },
  ctrader: { initials: "cT", bg: "#2a9d8f" },
  "match-trader": { initials: "MX", bg: "#b48c46" },
  tradingview: { initials: "TV", bg: "#131722" },
};

// No brand logo image assets in this project — a plain colored monogram
// badge stands in for one, so a platform doesn't need any external asset.
function PlatformLogo({ slug }: { slug: string }) {
  const style = PLATFORM_LOGO_STYLE[slug] ?? { initials: slug.slice(0, 2).toUpperCase(), bg: "#1d3557" };
  return (
    <div
      aria-hidden
      className="flex h-9 w-9 items-center justify-center rounded-lg text-[10px] font-bold text-white"
      style={{ backgroundColor: style.bg }}
    >
      {style.initials}
    </div>
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
