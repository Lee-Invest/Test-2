import { LegalPage } from "@/components/legal-page";
import { branding } from "@/lib/branding";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        {branding.name} collects the information necessary to create your account, process payments, and evaluate
        your trading activity, including your name, email address, and trading history on our platform.
      </p>
      <p>
        We do not sell personal data. Payment details are processed by our payment provider and are never stored on
        our servers. This is placeholder MVP copy and should be reviewed by qualified legal counsel before
        production use.
      </p>
    </LegalPage>
  );
}
