import Link from "next/link";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export default function CheckoutSuccessPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-3xl font-bold text-gray-900">Payment received</h1>
        <p className="mt-4 text-gray-600">
          Thanks for starting your challenge. Your Phase 1 account has been created and is ready
          on your dashboard.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-block rounded-md bg-[var(--brand-primary)] px-6 py-3 text-sm font-semibold text-white hover:opacity-90"
        >
          Go to Dashboard
        </Link>
      </main>
      <Footer />
    </>
  );
}
