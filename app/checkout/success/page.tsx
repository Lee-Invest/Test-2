import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: { orderId?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login?next=/dashboard");

  const order = searchParams.orderId
    ? await prisma.order.findUnique({
        where: { id: searchParams.orderId },
        include: { template: true, platform: true, account: true },
      })
    : null;

  const owned = order && order.userId === session.user.id ? order : null;
  // A short, human-friendly reference — not a secret, just easier to say
  // over support chat than the full internal id.
  const accountRef = owned?.account ? `APX-${owned.account.id.slice(-6).toUpperCase()}` : null;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7">
            <path d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.4 7.4a1 1 0 0 1-1.4 0L3.3 9.5a1 1 0 1 1 1.4-1.4l3.9 3.9 6.7-6.7a1 1 0 0 1 1.4 0Z" />
          </svg>
        </div>
        <h1 className="mt-6 text-3xl font-bold text-gray-900">Your challenge is ready.</h1>
        <p className="mt-3 text-gray-600">
          Your account has been created and is ready on your dashboard.
        </p>

        {owned && (
          <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm">
            <Row label="Account" value={accountRef ?? "Processing…"} />
            <Row label="Platform" value={owned.platform?.name ?? "No preference"} />
            <Row label="Status" value={owned.account ? "Ready to trade" : "Processing"} last />
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            href="/dashboard"
            style={{ backgroundColor: "#2563eb" }}
            className="rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-600/20 hover:opacity-90"
          >
            Open Dashboard
          </a>
          {(owned?.platform?.webUrl || owned?.platform?.downloadUrl || owned?.platform?.accessUrl) && (
            <a
              href={owned.platform!.webUrl ?? owned.platform!.downloadUrl ?? owned.platform!.accessUrl!}
              className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Trading Platform
            </a>
          )}
          <a href="/rules" className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            View Rules
          </a>
        </div>

        {owned?.platform && owned.platform.setupSteps.length > 0 && (
          <details className="mt-6 text-left text-sm">
            <summary className="cursor-pointer font-medium text-[var(--brand-primary)]">
              How to connect to {owned.platform.name}
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-gray-600">
              {owned.platform.setupSteps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </details>
        )}
      </main>
      <Footer />
    </>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-2.5 ${last ? "" : "border-b border-gray-100"}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
