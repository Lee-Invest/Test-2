// Plain <a> links instead of client-side tab state: navigating between
// /dashboard and /dashboard/payouts works via an ordinary page request,
// so it never depends on client JS having mounted.
export function DashboardTabs({ active }: { active: "overview" | "payouts" }) {
  return (
    <div className="mt-6 flex gap-2 border-b border-gray-200">
      <Tab href="/dashboard" active={active === "overview"}>
        Overview
      </Tab>
      <Tab href="/dashboard/payouts" active={active === "payouts"}>
        Payouts
      </Tab>
    </div>
  );
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
        active ? "border-[var(--brand-primary)] text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"
      }`}
    >
      {children}
    </a>
  );
}
