import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function CheckoutSuccessPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-bold">Payment received</h1>
        <p className="mt-4 text-white/70">
          Thanks for starting your challenge. Once your payment is confirmed by our webhook, your Phase 1 account
          will appear on your dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-md bg-[var(--brand-primary)] px-6 py-3 text-sm font-semibold hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </main>
      <Footer />
    </>
  );
}
