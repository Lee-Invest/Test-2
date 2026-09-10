import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";
import { formatCents } from "@/lib/utils";

// Server-rendered: the order is looked up directly here instead of via a
// client-side fetch after mount, and "Pay" is a native <form> POST to
// /api/checkout/confirm (extended to accept a form post and redirect to
// /checkout/success), so nothing on this page depends on client JS.
export default async function SimulatedPaymentPage({
  searchParams,
}: {
  searchParams: { orderId?: string; error?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect(`/login?next=/checkout/pay${searchParams.orderId ? `?orderId=${searchParams.orderId}` : ""}`);

  if (!searchParams.orderId) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
          <p className="text-gray-600">Missing order. Start again from the pricing page.</p>
        </main>
        <Footer />
      </>
    );
  }

  const order = await prisma.order.findUnique({
    where: { id: searchParams.orderId },
    include: { template: true },
  });

  if (!order || order.userId !== session.user.id) {
    return (
      <>
        <Nav />
        <main className="mx-auto max-w-md px-4 py-24 text-center sm:px-6">
          <p className="text-gray-600">Order not found. Start again from the pricing page.</p>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <strong>Simulated payment.</strong> No real Stripe account is configured for this environment — no card
          data is collected, transmitted, or charged anywhere. Submitting this form provisions your challenge account
          directly, the same way a real payment webhook would.
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">Complete your payment</h1>

          <div className="mt-4 flex items-center justify-between border-b border-gray-200 pb-4 text-sm">
            <span className="text-gray-600">{order.template.name}</span>
            <span className="font-semibold text-gray-900">{formatCents(order.totalCents)}</span>
          </div>

          <form action="/api/checkout/confirm" method="POST" className="mt-6 space-y-4">
            <input type="hidden" name="orderId" value={order.id} />
            <div>
              <label className="mb-1 block text-xs text-gray-600">Cardholder name</label>
              <input
                required
                name="cardholderName"
                placeholder="Jane Trader"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-600">Card number</label>
              <input
                required
                name="cardNumber"
                defaultValue="4242 4242 4242 4242"
                inputMode="numeric"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-600">Expiry</label>
                <input
                  required
                  name="expiry"
                  defaultValue="12/34"
                  inputMode="numeric"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 outline-none focus:border-[var(--brand-primary)]"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-600">CVC</label>
                <input
                  required
                  name="cvc"
                  defaultValue="123"
                  inputMode="numeric"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono text-gray-900 outline-none focus:border-[var(--brand-primary)]"
                />
              </div>
            </div>

            {searchParams.error && <p className="text-sm text-red-600">{searchParams.error}</p>}

            <button
              type="submit"
              className="w-full rounded-md bg-[var(--brand-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              Pay {formatCents(order.totalCents)}
            </button>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}
