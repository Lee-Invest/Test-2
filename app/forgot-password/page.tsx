import { Nav } from "@/components/nav";

// Server-rendered: a plain <form> posting natively to
// /api/auth/forgot-password, which redirects back with ?sent=1 or
// ?error=... — no client JS required for this to work.
export default function ForgotPasswordPage({ searchParams }: { searchParams: { sent?: string; error?: string } }) {
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-md flex-col px-4 py-20 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
        {searchParams.sent ? (
          <p className="mt-6 text-gray-600">
            If an account exists for that email, a reset link has been sent (check the server console in dev mode).
          </p>
        ) : (
          <form action="/api/auth/forgot-password" method="POST" className="mt-8 space-y-4">
            <div>
              <label className="block text-sm text-gray-600">Email</label>
              <input
                type="email"
                required
                name="email"
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-[var(--brand-primary)]"
              />
            </div>
            {searchParams.error && <p className="text-sm text-red-600">{searchParams.error}</p>}
            <button
              type="submit"
              className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              Send reset link
            </button>
          </form>
        )}
      </main>
    </>
  );
}
