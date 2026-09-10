import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { formatCents } from "@/lib/utils";
import { STATIC_TEMPLATES } from "@/lib/static-templates";
import { STATIC_PLATFORMS } from "@/lib/static-platforms";

// Server-rendered, static comparison: pick up to 3 account sizes via plain
// checkboxes (a GET form), compare them side by side. No client JS, no
// database round trip — every number here already lives in
// lib/static-templates.ts.
export default function ComparePage({ searchParams }: { searchParams: { t?: string | string[] } }) {
  const requested = Array.isArray(searchParams.t) ? searchParams.t : searchParams.t ? [searchParams.t] : [];
  const selectedIds = requested.filter((id) => STATIC_TEMPLATES.some((t) => t.id === id)).slice(0, 3);
  const selected = selectedIds.length > 0 ? STATIC_TEMPLATES.filter((t) => selectedIds.includes(t.id)) : STATIC_TEMPLATES.slice(0, 3);

  const rows: { label: string; get: (t: (typeof STATIC_TEMPLATES)[number]) => string }[] = [
    { label: "Price", get: (t) => formatCents(t.priceCents) },
    { label: "Phase 1 Target", get: (t) => `${t.phase1ProfitTargetPct}%` },
    { label: "Phase 2 Target", get: (t) => `${t.phase2ProfitTargetPct}%` },
    { label: "Daily Loss", get: (t) => `${t.maxDailyLossPct}%` },
    { label: "Max Loss", get: (t) => `${t.maxOverallLossPct}%` },
    { label: "Trading Days", get: (t) => `${t.phase1MinTradingDays} / ${t.phase2MinTradingDays}` },
    { label: "Profit Split", get: (t) => `${t.profitSplitTraderPct}%` },
    { label: "Platform", get: () => STATIC_PLATFORMS.filter((p) => p.mode === "EXECUTION").map((p) => p.name).join(", ") },
    { label: "Add-ons", get: () => "Configured at checkout" },
  ];

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Compare account sizes</h1>
        <p className="mt-2 text-gray-600">Pick up to 3 to compare side by side.</p>

        <form method="GET" action="/pricing/compare" className="mt-6 flex flex-wrap gap-3">
          {STATIC_TEMPLATES.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 has-[:checked]:border-[var(--brand-primary)] has-[:checked]:text-gray-900"
            >
              <input type="checkbox" name="t" value={t.id} defaultChecked={selected.some((s) => s.id === t.id)} />
              ${t.accountSize.toLocaleString()}
            </label>
          ))}
          <button type="submit" className="rounded-full bg-[var(--brand-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Compare
          </button>
        </form>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 font-medium text-gray-400">Feature</th>
                {selected.map((t) => (
                  <th key={t.id} className="py-3 px-4 font-semibold text-gray-900">
                    ${t.accountSize.toLocaleString()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-gray-100">
                  <td className="py-2.5 px-4 text-gray-500">{row.label}</td>
                  {selected.map((t) => (
                    <td key={t.id} className="py-2.5 px-4 text-gray-900">
                      {row.get(t)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-gray-100">
                <td className="py-3 px-4" />
                {selected.map((t) => (
                  <td key={t.id} className="py-3 px-4">
                    <a
                      href={`/pricing?template=${t.id}`}
                      style={{ backgroundColor: "#2563eb" }}
                      className="inline-block rounded-lg px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Choose this
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </>
  );
}
