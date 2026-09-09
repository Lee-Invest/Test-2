import { LegalPage } from "@/components/legal-page";
import { branding } from "@/lib/branding";

export default function RiskDisclosurePage() {
  return (
    <LegalPage title="Risk Disclosure">
      <p>
        Trading financial instruments carries a high level of risk and may not be suitable for all individuals.
        {" "}{branding.name} evaluation accounts are simulated and do not involve real market execution; funded
        accounts trade firm capital under the rules of your funding agreement.
      </p>
      <p>
        Past performance, including performance during an evaluation, is not indicative of future results.
        {" "}{branding.name} makes no guarantee of profit, funding, or income at any stage, and you may lose your
        evaluation fee if you do not complete the challenge successfully.
      </p>
    </LegalPage>
  );
}
