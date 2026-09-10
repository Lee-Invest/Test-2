import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES } from "@/lib/static-templates";
import { STATIC_PLATFORMS, STATIC_PLATFORM_AVAILABILITY } from "@/lib/static-platforms";

// Server-rendered, same reasoning as /dashboard and /login: this page's
// interactivity (changing account size/platform, agreeing to the rules,
// buying) previously depended entirely on client-side React state and
// fetch(), which turned out to never execute at all in the reporting
// user's browser. Everything here works via plain HTML — a GET <form> to
// re-render this same page with a different selection, and a POST <form>
// straight to /api/checkout (extended to accept a form post and redirect to
// the resulting payment page) — so none of it depends on client JS.
export default async function BuyChallengePage({
  searchParams,
}: {
  searchParams: { template?: string; platform?: string; coupon?: string; error?: string };
}) {
  const session = await getServerSession(authOptions);
  const templates = STATIC_TEMPLATES;
  const selected = templates.find((t) => t.id === searchParams.template) ?? templates[Math.floor(templates.length / 2)];
  const platformId = searchParams.platform ?? "";
  const couponCode = searchParams.coupon ?? "";

  const platformAvail = platformId
    ? STATIC_PLATFORM_AVAILABILITY.find((a) => a.templateId === selected.id && a.platformId === platformId)
    : undefined;
  const platformFeeCents = !platformAvail || platformAvail.allowed ? platformAvail?.feeCents ?? 0 : 0;
  const totalCents = selected.priceCents + platformFeeCents;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-[var(--brand-accent)]">Get Funded</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Buy a Challenge</h1>
          <p className="mt-3 text-gray-600">
            Pick a size and platform, agree to the rules, then pay. Every price and rule is re-verified server-side at
            checkout.
          </p>

          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            {searchParams.error && (
              <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {searchParams.error}
              </p>
            )}

            {/* Selecting a different account size / platform reloads this
                page with the new choice via a plain GET — works with zero
                client JS. */}
            <form method="GET" action="/pricing">
              <label className="block text-sm font-medium text-gray-700">Account size</label>
              <select
                name="template"
                defaultValue={selected.id}
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
                name="platform"
                defaultValue={platformId}
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

              <button
                type="submit"
                className="mt-4 w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Update
              </button>
            </form>

            <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
              <RuleRow label="Phase 1 Target" value={`${selected.phase1ProfitTargetPct}%`} />
              <RuleRow label="Phase 2 Target" value={`${selected.phase2ProfitTargetPct}%`} />
              <RuleRow label="Max Daily Loss" value={`${selected.maxDailyLossPct}%`} />
              <RuleRow label="Max Total Loss" value={`${selected.maxOverallLossPct}%`} />
              <RuleRow
                label="Min Trading Days"
                value={`${selected.phase1MinTradingDays} / ${selected.phase2MinTradingDays}`}
              />
              <RuleRow label="Profit Split" value={`${selected.profitSplitTraderPct}% to you`} />
            </div>

            {/* This form does the actual purchase: a native POST straight to
                /api/checkout, which re-validates everything server-side and
                redirects to the payment page — no fetch(), no client state. */}
            <form action="/api/checkout" method="POST" className="mt-6 border-t border-gray-200 pt-6">
              <input type="hidden" name="templateId" value={selected.id} />
              {platformId && <input type="hidden" name="platformId" value={platformId} />}

              <label className="block text-sm font-medium text-gray-700">Coupon code (optional)</label>
              <input
                name="couponCode"
                defaultValue={couponCode}
                placeholder="e.g. WELCOME10"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
              />

              <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-2xl font-bold text-gray-900">{formatCents(totalCents)}</span>
              </div>

              <label className="mt-4 flex items-start gap-2 rounded-md p-1 text-xs text-gray-700">
                <input required name="agreedToRules" type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300" />
                <span>
                  I agree to the Funded Trader Agreement and{" "}
                  <a href="/rules" className="underline">
                    Trading Rules
                  </a>{" "}
                  for this account size.
                </span>
              </label>

              {session?.user ? (
                <button
                  type="submit"
                  style={{ backgroundColor: "#2563eb" }}
                  className="mt-4 w-full rounded-md px-4 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  Buy Challenge
                </button>
              ) : (
                <a
                  href="/login?next=/pricing"
                  style={{ backgroundColor: "#2563eb" }}
                  className="mt-4 block w-full rounded-md px-4 py-3 text-center text-sm font-semibold text-white hover:opacity-90"
                >
                  Log in to buy this challenge
                </a>
              )}
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </>
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
