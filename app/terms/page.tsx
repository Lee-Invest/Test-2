import { LegalPage } from "@/components/legal-page";
import { branding } from "@/lib/branding";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>
        These Terms govern your use of {branding.name}&apos;s evaluation and funding services, operated by{" "}
        {branding.legalEntity}. By purchasing a challenge you agree to trade within the published rules for your
        account, including profit targets, loss limits, and minimum trading day requirements.
      </p>
      <p>
        Evaluation accounts are simulated. Funded accounts are subject to a separate profit-sharing agreement.
        {branding.name} may suspend or close any account found to violate its trading rules or this agreement.
      </p>
      <p>This is placeholder MVP copy and should be reviewed by qualified legal counsel before production use.</p>
    </LegalPage>
  );
}
