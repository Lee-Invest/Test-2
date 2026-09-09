import { LegalPage } from "@/components/legal-page";

export default function HowItWorksPage() {
  return (
    <LegalPage title="How It Works">
      <p>
        ApexFund evaluates trading skill through a structured, two-phase challenge before allocating firm capital.
        Every step uses the same transparent rule set, configured centrally and shown to you before you buy.
      </p>
      <h2 className="text-xl font-semibold text-gray-900">Phase 1 — Challenge</h2>
      <p>
        Reach the Phase 1 profit target while respecting the maximum daily loss and maximum overall loss limits, and
        trade on at least the minimum number of trading days. There is no maximum time limit for Phase 1.
      </p>
      <h2 className="text-xl font-semibold text-gray-900">Phase 2 — Verification</h2>
      <p>
        Once Phase 1 is passed, your account resets to the same starting balance for Phase 2, with a lower profit
        target and the same drawdown rules, confirming your process is repeatable.
      </p>
      <h2 className="text-xl font-semibold text-gray-900">Funded Stage</h2>
      <p>
        After passing both phases, you receive a funded account with the same starting balance. You keep a majority
        share of the profits you generate, split according to your challenge&apos;s profit-split percentage.
      </p>
      <h2 className="text-xl font-semibold text-gray-900">Risk Rules</h2>
      <p>
        Daily loss and overall loss are measured against both your account balance and your live equity, whichever
        is worse at any given moment — so both realized and floating losses count. See our Trading Rules page for
        full details.
      </p>
    </LegalPage>
  );
}
