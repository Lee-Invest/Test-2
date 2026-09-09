import { LegalPage } from "@/components/legal-page";

export default function RulesPage() {
  return (
    <LegalPage title="Trading Rules">
      <ul className="list-disc space-y-3 pl-5">
        <li>Maximum daily loss and maximum overall loss are evaluated continuously against both balance and equity.</li>
        <li>The daily loss baseline resets once per trading day at the configured daily reset time (default 00:00 UTC).</li>
        <li>Minimum trading days require at least one closed trade on that many distinct trading days.</li>
        <li>There is no maximum time limit to complete Phase 1 or Phase 2.</li>
        <li>Accounts that breach a loss limit are marked failed immediately, at any phase, including the funded stage.</li>
        <li>All specific numeric limits for your challenge are shown on the Pricing page before purchase and on your dashboard afterward.</li>
      </ul>
      <p className="mt-6 text-sm text-gray-500">
        Full technical formulas are documented in our public risk engine reference for transparency.
      </p>
    </LegalPage>
  );
}
