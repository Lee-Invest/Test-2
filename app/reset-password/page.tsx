import { Nav } from "@/components/nav";

// Server-rendered: reads ?token= directly as a server-side searchParam
// (no useSearchParams()/Suspense needed) and posts natively to
// /api/auth/reset-password, which redirects to /login?reset=1 on success.
export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string; error?: string };
}) {
  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-md flex-col px-4 py-20 sm:px-6">
        <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
        <form action="/api/auth/reset-password" method="POST" className="mt-8 space-y-4">
          <input type="hidden" name="token" value={searchParams.token ?? ""} />
          <input
            type="password"
            required
            minLength={8}
            name="password"
            placeholder="New password"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 outline-none focus:border-[var(--brand-primary)]"
          />
          {searchParams.error && <p className="text-sm text-red-600">{searchParams.error}</p>}
          <button
            type="submit"
            className="w-full rounded-md bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Update password
          </button>
        </form>
      </main>
    </>
  );
}
