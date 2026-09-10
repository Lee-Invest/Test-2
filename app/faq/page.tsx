import { LegalPage } from "@/components/legal-page";

const faqs = [
  {
    q: "What account sizes are available?",
    a: "Challenges are available for $10,000, $25,000, $50,000, $100,000, and $200,000 simulated accounts.",
  },
  {
    q: "Is my trading capital guaranteed to be profitable?",
    a: "No. Trading carries substantial risk of loss and there is no guarantee of profit at any stage. ApexFund does not promise or guarantee any level of income.",
  },
  {
    q: "How is daily loss calculated?",
    a: "We compare your account balance and live equity against the higher of the two at the start of the trading day, using whichever of balance or equity is currently lower. See our Risk Engine documentation for the exact formula.",
  },
  {
    q: "What happens if I breach a rule?",
    a: "Breaching the maximum daily loss or maximum overall loss limit fails the account immediately at any phase.",
  },
  {
    q: "How do payouts work once funded?",
    a: "You can request a payout once eligible; our team reviews and processes approved payouts according to your profit split.",
  },
];

export default function FaqPage() {
  return (
    <LegalPage title="Frequently Asked Questions">
      <dl className="space-y-6">
        {faqs.map((f) => (
          <div key={f.q}>
            <dt className="font-semibold text-white">{f.q}</dt>
            <dd className="mt-1">{f.a}</dd>
          </div>
        ))}
      </dl>
    </LegalPage>
  );
}
