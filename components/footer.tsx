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
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div>
            <div className="text-lg font-bold text-gray-900">{branding.name}</div>
            <p className="mt-2 max-w-xs text-sm text-gray-500">{branding.tagline}</p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <div className="text-sm font-semibold text-gray-800">{col.title}</div>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-gray-500 hover:text-gray-900">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-gray-200 pt-6 text-xs text-gray-400">
          &copy; {new Date().getFullYear()} {branding.legalEntity}. Trading involves substantial risk. Past
          performance is not indicative of future results. {branding.name} is an evaluation and funding platform;
          it does not provide investment advice.
        </div>
      </div>
    </footer>
  );
}
