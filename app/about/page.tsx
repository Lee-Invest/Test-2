import { LegalPage } from "@/components/legal-page";
import { branding } from "@/lib/branding";

export default function AboutPage() {
  return (
    <LegalPage title={`About ${branding.name}`}>
      <p>
        {branding.name} is an evaluation and funding platform built for disciplined, risk-aware traders. We believe
        capital should follow demonstrated process, not promises — which is why every rule in our challenges is
        published, consistent, and applied identically to every trader.
      </p>
      <p>
        We are not a broker and we do not offer investment advice. {branding.legalEntity} operates simulated
        evaluation accounts and, upon successful completion, allocates firm capital to funded traders under a
        profit-sharing agreement.
      </p>
    </LegalPage>
  );
}
