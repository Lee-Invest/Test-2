import Link from "next/link";
import { branding } from "@/lib/branding";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/pricing", label: "Challenges" },
      { href: "/how-it-works", label: "How It Works" },
      { href: "/rules", label: "Trading Rules" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/risk-disclosure", label: "Risk Disclosure" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#08080f]">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div className="text-lg font-bold">{branding.name}</div>
            <p className="mt-2 max-w-xs text-sm text-white/50">{branding.tagline}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-sm font-semibold text-white/80">{col.title}</div>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-white/50 hover:text-white">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-white/10 pt-6 text-xs text-white/40">
          &copy; {new Date().getFullYear()} {branding.legalEntity}. Trading involves substantial risk. Past
          performance is not indicative of future results. {branding.name} is an evaluation and funding platform;
          it does not provide investment advice.
        </div>
      </div>
    </footer>
  );
}
