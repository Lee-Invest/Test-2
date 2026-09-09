import { LegalPage } from "@/components/legal-page";
import { branding } from "@/lib/branding";

export default function ContactPage() {
  return (
    <LegalPage title="Contact Us">
      <p>
        Questions about your account, an order, or a payout? Reach our support team at{" "}
        <a href={`mailto:${branding.supportEmail}`} className="text-[var(--brand-accent)]">
          {branding.supportEmail}
        </a>
        . We aim to respond within one business day.
      </p>
    </LegalPage>
  );
}
