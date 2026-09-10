import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { STATIC_TEMPLATES } from "@/lib/static-templates";
import { STATIC_PLATFORMS } from "@/lib/static-platforms";
import { formatCents } from "@/lib/utils";

const TRADE_TYPES = ["Forex", "Indices", "Gold", "Crypto", "Futures"];
const STYLES = [
  { value: "manual", label: "Manual" },
  { value: "algo", label: "Algorithmic" },
];
const PLATFORM_PREFS = [
  { value: "", label: "No preference" },
  { value: "platform-mt5", label: "MT5" },
  { value: "platform-ctrader", label: "cTrader" },
  { value: "platform-match-trader", label: "Match-Trader" },
];

// A short, static "Help me choose" questionnaire — a plain GET form, the
// recommendation is computed server-side from the answers already in the
// URL. Always presented as a suggestion, never financial advice.
export default function WizardPage({
  searchParams,
}: {
  searchParams: { trade?: string; style?: string; platform?: string; size?: string };
}) {
  const answered = Boolean(searchParams.style && searchParams.size);
  const style = searchParams.style ?? "manual";
  const platformPref = searchParams.platform ?? "";
  const template = STATIC_TEMPLATES.find((t) => t.id === searchParams.size) ?? STATIC_TEMPLATES[2];

  const recommendedPlatformId = platformPref || (style === "algo" ? "platform-mt5" : "platform-mt4");
  const recommendedPlatform = STATIC_PLATFORMS.find((p) => p.id === recommendedPlatformId);

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Help me choose</h1>
        <p className="mt-2 text-gray-600">Answer a few quick questions for a suggested setup.</p>

        <form method="GET" action="/pricing/wizard" className="mt-8 space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700">What do you trade?</label>
            <select name="trade" defaultValue={searchParams.trade} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {TRADE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Trading style?</label>
            <div className="mt-2 flex gap-3">
              {STYLES.map((s) => (
                <label key={s.value} className="flex items-center gap-2 rounded-full border border-gray-300 px-4 py-2 text-sm has-[:checked]:border-[var(--brand-primary)]">
                  <input type="radio" name="style" value={s.value} defaultChecked={style === s.value} /> {s.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Preferred platform?</label>
            <select name="platform" defaultValue={platformPref} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {PLATFORM_PREFS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Preferred account size?</label>
            <select name="size" defaultValue={template.id} className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900">
              {STATIC_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  ${t.accountSize.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="w-full rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90">
            Show my recommendation
          </button>
        </form>

        {answered && (
          <div className="mt-8 rounded-2xl border border-[var(--brand-primary)]/30 bg-[var(--brand-primary)]/5 p-6">
            <h2 className="text-lg font-semibold text-gray-900">Recommended setup</h2>
            <p className="mt-1 text-sm text-gray-600">
              ${template.accountSize.toLocaleString()} account on {recommendedPlatform?.name ?? "your preferred platform"}, for{" "}
              {formatCents(template.priceCents)}.
            </p>
            <p className="mt-3 text-xs text-gray-500">
              This is a suggestion based on your answers, not financial advice — review the full rules before buying.
            </p>
            <a
              href={`/pricing?template=${template.id}&platform=${recommendedPlatformId}`}
              style={{ backgroundColor: "#2563eb" }}
              className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Use this configuration
            </a>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
