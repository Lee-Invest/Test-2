import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { formatCents } from "@/lib/utils";

type Tab = "analytics" | "templates" | "platforms" | "accounts" | "payouts";
const TABS: Tab[] = ["analytics", "templates", "platforms", "accounts", "payouts"];

// Server-rendered, same reasoning as the rest of the site: every tab here
// previously fetched its own data client-side and mutated via fetch()
// inside onClick handlers. Now each tab is computed directly server-side
// and every action is a native <form> POST to its existing admin API route
// (each extended to accept a form post and redirect back to /admin?tab=...),
// so none of it depends on client JS.
export default async function AdminPage({
  searchParams,
}: {
  searchParams: { tab?: string; error?: string };
}) {
  const tab: Tab = TABS.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : "analytics";

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Admin</h1>
        <div className="mt-6 flex gap-2 border-b border-gray-200">
          {TABS.map((t) => (
            <a
              key={t}
              href={`/admin?tab=${t}`}
              className={`px-4 py-2 text-sm font-medium capitalize ${
                tab === t ? "border-b-2 border-[var(--brand-primary)] text-gray-900" : "text-gray-500"
              }`}
            >
              {t}
            </a>
          ))}
        </div>

        {searchParams.error && (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {searchParams.error}
          </p>
        )}

        <div className="mt-8">
          {tab === "analytics" && <Analytics />}
          {tab === "templates" && <Templates />}
          {tab === "platforms" && <Platforms />}
          {tab === "accounts" && <Accounts />}
          {tab === "payouts" && <Payouts />}
        </div>
      </main>
    </>
  );
}

async function Analytics() {
  const [revenue, activeTraders, phases, fundedCount] = await Promise.all([
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { totalCents: true } }),
    prisma.account.count({ where: { isActive: true } }),
    prisma.challengePhase.groupBy({ by: ["status"], _count: true }),
    prisma.challengePhase.count({ where: { type: "FUNDED" } }),
  ]);

  const passed = phases.find((p) => p.status === "PASSED")?._count ?? 0;
  const failed = phases.find((p) => p.status === "FAILED")?._count ?? 0;
  const totalDecided = passed + failed;

  const cards = [
    { label: "Revenue", value: formatCents(revenue._sum.totalCents ?? 0) },
    { label: "Active Traders", value: activeTraders.toString() },
    { label: "Pass Rate", value: `${totalDecided > 0 ? Math.round((passed / totalDecided) * 100) : 0}%` },
    { label: "Fail Rate", value: `${totalDecided > 0 ? Math.round((failed / totalDecided) * 100) : 0}%` },
    { label: "Funded Accounts", value: fundedCount.toString() },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-400">{c.label}</div>
          <div className="mt-1 text-xl font-bold text-gray-900">{c.value}</div>
        </div>
      ))}
    </div>
  );
}

async function Templates() {
  const templates = await prisma.challengeTemplate.findMany({ orderBy: { accountSize: "asc" } });

  return (
    <div className="space-y-6">
      {templates.map((t) => (
        <form key={t.id} action="/api/admin/templates" method="POST" className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="name" value={t.name} />
          <input type="hidden" name="dailyResetTimeUtc" value={t.dailyResetTimeUtc} />
          <div className="flex items-center justify-between">
            <div className="font-semibold text-gray-900">
              ${t.accountSize.toLocaleString()} — {t.name}
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" name="active" defaultChecked={t.active} />
              Active
            </label>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Account Size" name="accountSize" defaultValue={t.accountSize} />
            <Field label="Price (cents)" name="priceCents" defaultValue={t.priceCents} />
            <Field label="P1 Target %" name="phase1ProfitTargetPct" defaultValue={t.phase1ProfitTargetPct.toString()} />
            <Field label="P2 Target %" name="phase2ProfitTargetPct" defaultValue={t.phase2ProfitTargetPct.toString()} />
            <Field label="Max Daily Loss %" name="maxDailyLossPct" defaultValue={t.maxDailyLossPct.toString()} />
            <Field label="Max Overall Loss %" name="maxOverallLossPct" defaultValue={t.maxOverallLossPct.toString()} />
            <Field label="Min Days P1" name="phase1MinTradingDays" defaultValue={t.phase1MinTradingDays} />
            <Field label="Min Days P2" name="phase2MinTradingDays" defaultValue={t.phase2MinTradingDays} />
            <Field label="Profit Split %" name="profitSplitTraderPct" defaultValue={t.profitSplitTraderPct.toString()} />
          </div>
          <button
            type="submit"
            className="mt-4 rounded-md bg-[var(--brand-primary)] px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Save
          </button>
        </form>
      ))}
    </div>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string | number }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-gray-400">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
      />
    </div>
  );
}

async function Platforms() {
  const [platforms, templates, availability] = await Promise.all([
    prisma.tradingPlatform.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.challengeTemplate.findMany({ orderBy: { accountSize: "asc" } }),
    prisma.platformAvailability.findMany(),
  ]);

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Toggling availability here updates the same table the checkout page validates against — takes effect
        immediately, no deploy needed.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-gray-400">
            <tr>
              <th className="py-2 pr-4">Platform</th>
              <th className="py-2 pr-4">Active</th>
              {templates.map((t) => (
                <th key={t.id} className="py-2 pr-4">
                  ${t.accountSize.toLocaleString()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {platforms.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 text-gray-900">
                <td className="py-2 pr-4 font-medium">{p.name}</td>
                <td className="py-2 pr-4">
                  <ActionForm action="TOGGLE_ACTIVE" fields={{ platformId: p.id }}>
                    {p.active ? "Active" : "Inactive"}
                  </ActionForm>
                </td>
                {templates.map((t) => {
                  const avail = availability.find((a) => a.templateId === t.id && a.platformId === p.id);
                  const allowed = avail?.allowed ?? true;
                  return (
                    <td key={t.id} className="py-2 pr-4">
                      <ActionForm action="TOGGLE_AVAILABILITY" fields={{ templateId: t.id, platformId: p.id }}>
                        {allowed ? "Allowed" : "Blocked"}
                      </ActionForm>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActionForm({
  action,
  fields,
  actionUrl = "/api/admin/platforms",
  children,
}: {
  action: string;
  fields: Record<string, string>;
  actionUrl?: string;
  children: React.ReactNode;
}) {
  return (
    <form action={actionUrl} method="POST" className="inline">
      <input type="hidden" name="action" value={action} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button type="submit" className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50">
        {children}
      </button>
    </form>
  );
}

async function Accounts() {
  const accounts = await prisma.account.findMany({
    include: { user: { select: { email: true, name: true } }, template: true, phases: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-gray-400">
          <tr>
            <th className="py-2 pr-4">Trader</th>
            <th className="py-2 pr-4">Size</th>
            <th className="py-2 pr-4">Balance</th>
            <th className="py-2 pr-4">Phase</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a) => (
            <tr key={a.id} className="border-t border-gray-100 text-gray-900">
              <td className="py-2 pr-4">{a.user.name ?? a.user.email}</td>
              <td className="py-2 pr-4">${a.template.accountSize.toLocaleString()}</td>
              <td className="py-2 pr-4">{formatCents(a.currentBalanceCents)}</td>
              <td className="py-2 pr-4">{a.phases[0]?.type ?? "—"}</td>
              <td className="py-2 pr-4">{a.isActive ? "Active" : "Suspended"}</td>
              <td className="py-2 pr-4 space-x-2">
                {(["SUSPEND", "REACTIVATE", "RESET", "MARK_FUNDED", "MARK_REFUNDED", "CLOSE"] as const).map((action) => (
                  <ActionForm key={action} action={action} fields={{ accountId: a.id }} actionUrl="/api/admin/accounts">
                    {action.charAt(0) + action.slice(1).toLowerCase().replace("_", " ")}
                  </ActionForm>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function Payouts() {
  const payouts = await prisma.payout.findMany({
    include: { account: { include: { user: { select: { email: true, name: true } } } } },
    orderBy: { requestedAt: "desc" },
  });

  if (payouts.length === 0) return <p className="text-gray-500">No payout requests yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-gray-400">
          <tr>
            <th className="py-2 pr-4">Trader</th>
            <th className="py-2 pr-4">Amount</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Actions</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((p) => (
            <tr key={p.id} className="border-t border-gray-100 text-gray-900">
              <td className="py-2 pr-4">{p.account.user.name ?? p.account.user.email}</td>
              <td className="py-2 pr-4">{formatCents(p.amountCents)}</td>
              <td className="py-2 pr-4">{p.status}</td>
              <td className="py-2 pr-4 space-x-2">
                <ActionForm action="APPROVE" fields={{ payoutId: p.id }} actionUrl="/api/admin/payouts">
                  Approve
                </ActionForm>
                <form action="/api/admin/payouts" method="POST" className="inline-flex items-center gap-1">
                  <input type="hidden" name="action" value="REJECT" />
                  <input type="hidden" name="payoutId" value={p.id} />
                  <input
                    name="rejectionReason"
                    placeholder="Reason"
                    required
                    className="w-24 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-900"
                  />
                  <button type="submit" className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-700 hover:bg-gray-50">
                    Reject
                  </button>
                </form>
                <ActionForm action="MARK_PAID" fields={{ payoutId: p.id }} actionUrl="/api/admin/payouts">
                  Mark Paid
                </ActionForm>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
